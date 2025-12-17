# GitHub Integration

Location: `lib/arkiv/githubIssueLink.ts`

## Purpose

Link app feedback entities to GitHub issues for tracking. Enables transparent connection between user feedback and issue tracking.

## Implementation

GitHub integration creates GitHub issues from app feedback and stores the link as an Arkiv entity. All links are stored on Arkiv with no external database required.

## Entity Type

`github_issue_link`

Entity fields:
- `feedbackKey` (reference to `app_feedback` entity)
- `issueNumber` (GitHub issue number)
- `issueUrl` (GitHub issue URL)
- `repository` (e.g., "understories/p2pmentor")
- `createdAt` (ISO timestamp)

Entities are queryable via `feedbackKey` attribute.

## API Routes

- `/api/github/create-issue`: Creates GitHub issue from app feedback
- `/api/github/close-issue`: Closes GitHub issue
- `/api/github/issue-links`: Lists issue links for feedback

## Usage

GitHub issues are created from app feedback with:
- Title: `[feedbackType] page: message preview`
- Body: Includes page, type, rating, wallet, message, and Arkiv explorer link
- Labels: `['bug', 'feedback']` for issues, `['feedback']` for general feedback

The link between feedback and GitHub issue is stored as an Arkiv entity for transparency and auditability.

