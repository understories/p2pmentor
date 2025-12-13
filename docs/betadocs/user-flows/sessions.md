# Sessions (Mentorship Meetings)

## Session creation

Request from ask to offer or from offer to ask. Session entity (`type: 'session'`) records mentor, learner, skill, scheduled time, duration. Optional payment fields: `requiresPayment`, `paymentAddress`, `cost`. Separate `session_txhash` entity for transaction hash tracking.

## Confirmation flow

`session_confirmation` entities (one per party) linked via `sessionKey`. `session_rejection` entities for cancellations. Status computed from main session plus confirmations, rejections and expiration. Status flow: `pending` → `scheduled` (when both confirm) or `cancelled` (if rejected).

## Payment flow (for paid sessions)

`session_payment_submission` entity when learner submits payment txHash. `session_payment_validation` entity when mentor validates payment.

## Jitsi integration

Jitsi room created when both parties confirm. Room info stored in `session_jitsi` entity linked via `sessionKey`. Room name and join URL stored in entity payload.

## Lifecycle

Expiration: `sessionDate + duration + 1 hour buffer`. Statuses: `pending`, `scheduled`, `in-progress`, `completed`, `cancelled`.
