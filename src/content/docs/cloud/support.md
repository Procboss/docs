---
title: Support & the staff console
description: "Tickets with the ProcBoss staff — auto-assigned to support admins, answered in the dashboard, notifications on your one preferred channel. The console's staff model: the config-email super admin plus support/basic sub-admins."
section: cloud
order: 6
---

ProcBoss Cloud has a built-in ticket system: when something needs a human — a deploy that keeps failing, a billing question, a bug you can't pin down — you open a ticket from the dashboard and the staff answers in the thread. Every hop notifies you on **one channel you pick**: email, Telegram or Discord.

## Opening a ticket

**Dashboard → Support → New ticket.** A ticket is a subject (≤120 characters) and the first message — say what you expected, what you saw, and name the repo/server/process if it's fleet-related. The thread that follows is the whole conversation: replies from you and from staff, plus any status notes.

Tickets have three states, and the state tells you who owes the next move:

| State | Meaning |
| --- | --- |
| **open** | waiting on support — someone is on it |
| **pending** | support replied, the ball is with you |
| **closed** | resolved — writing a reply reopens it |

You can close your own ticket anytime (**close ticket** button); replying to a closed ticket brings it right back to open, so a "closed" ticket is never a dead end.

## Your preferred channel

**Settings → Integrations → Notification channel.** Pick the ONE channel you actually watch:

- **Email** — your account's address. Delivery needs the server's email sender configured (Resend); if it isn't yet, the pick saves and delivery waits — the picker says so honestly.
- **Telegram** — your connected bot chat (the same pairing the alerts use).
- **Discord** — your connected webhook.

When you open a ticket you get a receipt; when staff replies, you get the reply and a link to the thread; when a ticket closes, you hear about that too. If your pick isn't connected, delivery falls back to the next reachable channel rather than staying silent — nothing pretends to have been sent.

## How tickets are assigned

New tickets auto-assign to the **support admin with the fewest live tickets** (ties go to the longest-serving account, so assignment is stable). If there are no support admins, the ticket lands on the super admin. Either way you never pick a person — the queue routes itself, and the staff can reassign inside the console as needed.

## The staff console (roles)

The admin console has no separate password login — staff sign in with their normal GitHub/Google account, and the dashboard shows them the **admin console →** link. Three roles, one field:

| Role | What they can do |
| --- | --- |
| **super admin** | everything — the config email list owns this role (promoted automatically at sign-in) |
| **support** | the ticket queue, user context, ecosystem moderation, audit |
| **basic** | the ecosystem queue and read-only context — content chores, no tickets |

The super admin grants and revokes sub-admins on the console's Users page (**Staff role…** in a user's row menu). Sub-admins see only their sections — the console sidebar obeys the same matrix — and sub-admin redirects land on their own first tool: support staff on the ticket queue, basic staff on the ecosystem queue.

## Internal notes

Staff replies can be flagged **internal note** — coordination the team writes next to the conversation (known-issue references, who's following up). You never see them; the thread you read is exactly what's meant for you.
