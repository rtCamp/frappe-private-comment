// NOTE: run `bench build` after making changes to this file
// alternatively, run `bench watch` to automatically build on file changes
import FormTimeline from "frappe/public/js/frappe/form/footer/form_timeline.js";

class CustomFormTimeline extends FormTimeline {
  constructor(opts, refresh_callback) {
    super(opts);
    this.refresh_callback = refresh_callback;
  }

  update_comment(name, content) {
    return frappe.xcall("frappe.desk.form.utils.update_comment", { name, content }).then(() => {
      frappe.utils.play_sound("click");
      this.refresh_callback();
    });
  }

  delete_comment(comment_name) {
    frappe.confirm(__("Delete comment?"), () => {
      return frappe
        .xcall("frappe.client.delete", {
          doctype: "Comment",
          name: comment_name,
        })
        .then(() => {
          frappe.utils.play_sound("delete");
          this.refresh_callback();
        });
    });
  }
}

frappe.ui.form.Footer = class extends frappe.ui.form.Footer {
  constructor(opts) {
    super(opts);
    // Once the timeline is rendered, setup the replies
    $(this.frm.wrapper).on("render_complete", () => {
      this.setup_replies();
    });
  }

  make_timeline() {
    this.frm.timeline = new CustomFormTimeline(
      {
        parent: this.wrapper.find(".timeline"),
        frm: this.frm,
      },
      this.setup_replies
    );
  }

  make_comment_box() {
    this.frm.comment_box = frappe.ui.form.make_control({
      parent: this.wrapper.find(".comment-box"),
      render_input: true,
      only_input: true,
      enable_mentions: true,
      df: {
        fieldtype: "Comment",
        fieldname: "comment",
      },
      on_submit: (comment, custom_visibility) => {
        if (strip_html(comment).trim() != "" || comment.includes("img")) {
          this.frm.comment_box.disable();
          frappe
            .xcall("frappe.desk.form.utils.add_comment", {
              reference_doctype: this.frm.doctype,
              reference_name: this.frm.docname,
              content: comment,
              comment_email: frappe.session.user,
              comment_by: frappe.session.user_fullname,
              custom_visibility: custom_visibility,
            })
            .then((comment) => {
              let comment_item = this.frm.timeline.get_comment_timeline_item(comment);
              this.frm.comment_box.set_value("");
              frappe.utils.play_sound("click");
              this.frm.timeline.add_timeline_item(comment_item);
              this.frm.sidebar.refresh_comments_count && this.frm.sidebar.refresh_comments_count();
            })
            .finally(() => {
              this.frm.comment_box.enable();
              update_comments_timeline();
            });
          this.refresh();
        }
      },
    });
  }

  refresh() {
    super.refresh();
    this.setup_replies();
  }

  setup_replies() {
    const docname = this.frm.docname;
    const doctype = this.frm.doctype;
    const $timelineItems = $("div.new-timeline > div.timeline-items");

    frappe.call({
      method: "frappe_private_comment.overrides.whitelist.comment.get_all_replies",
      args: {
        reference_name: docname,
        reference_doctype: doctype,
      },
      callback: (res) => {
        if (res.exc) {
          console.error(res.exc);
          return;
        }
        // No replies found
        if (!res.message || Object.keys(res.message).length === 0) return;

        $timelineItems.find('.timeline-item[data-doctype="Comment"]').each(function () {
          const $item = $(this);
          const commentId = $item.data("name");
          const replies = res.message[commentId];
          // NOTE: If the comment is a reply, remove from timeline as
          // we are manually showing it as a reply
          if (!res.message.hasOwnProperty(commentId)) {
            $item.remove();
            return;
          }

          add_reply_button($item);
          if (!replies || replies.length === 0) return;
          render_replies($item, replies);
        });
      },
    });
  }
};