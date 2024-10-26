import frappe
from frappe.desk.notifications import extract_mentions


def get_mention_user(content):
    if not content:
        return []

    users = extract_mentions(content)
    mention_users = []

    for user in users:
        mention_users.append({"user": user})

    return mention_users


def add_comments_in_timeline(doc, docinfo):
    # divide comments into separate lists
    docinfo.comments = []
    docinfo.shared = []
    docinfo.assignment_logs = []
    docinfo.attachment_logs = []
    docinfo.info_logs = []
    docinfo.like_logs = []
    docinfo.workflow_logs = []

    comments = frappe.get_all(
        "Comment",
        fields="*",
        filters={"reference_doctype": doc.doctype, "reference_name": doc.name},
    )

    filtered_comments = []

    if frappe.session.user != "Administrator":
        for comment in comments:
            if comment.custom_visibility == "Visible to only you":
                if comment.owner == frappe.session.user:
                    filtered_comments.append(comment)

            elif comment.custom_visibility == "Visible to mentioned":
                member = frappe.db.get_all(
                    "User Group Member",
                    filters={
                        "user": frappe.session.user,
                        "parent": comment.name,
                        "parenttype": "Comment",
                    },
                )

                if comment.owner == frappe.session.user or (len(member) > 0):
                    filtered_comments.append(comment)

            else:
                filtered_comments.append(comment)
    else:
        filtered_comments = comments

    for c in filtered_comments:
        match c.comment_type:
            case "Comment":
                c.content = frappe.utils.markdown(c.content)
                docinfo.comments.append(c)
            case "Shared" | "Unshared":
                docinfo.shared.append(c)
            case "Assignment Completed" | "Assigned":
                docinfo.assignment_logs.append(c)
            case "Attachment" | "Attachment Removed":
                docinfo.attachment_logs.append(c)
            case "Info" | "Edit" | "Label":
                docinfo.info_logs.append(c)
            case "Like":
                docinfo.like_logs.append(c)
            case "Workflow":
                docinfo.workflow_logs.append(c)

    return comments
