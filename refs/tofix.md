## Pass 1 (original issues)

- ~~Explorer doesn't displays Asks/Offers. Under All Types, it displays the lite_offer and lite_ask entities~~ FIXED: EntityCard now handles lite_ask/lite_offer with proper content display, readable badge labels, and API filtering groups them with asks/offers
- ~~On https://p2pmentor.com/learner-quests/ is difficult to click the Submit Answer / Next buttons given the overlay of icons. Maybe these icons could come up only when the cursor clicks one circle in the corner instead of six.~~ FIXED: Floating buttons now collapse behind a single +/x toggle button; users click to expand
- ~~Are entities being created when I click Submit? If these are entities, they are not showing on the explorer.~~ FIXED: Yes, entities are created (meta_learning_artifact for quest steps, learner_quest_progress for assessment answers). They now show in the explorer with a "Quest Progress" filter option.
- ~~I noticed that if I click Next instead of submitting first, when I click Previous the button says Submitting... Commenting in case that's not intended.~~ FIXED: handleNext now awaits the submission before navigating, so the Submitting... state clears before the user can go back.

## Pass 2 (code audit)

- ~~FloatingButtonCluster: expanded menu stays open when clicking outside or navigating~~ FIXED: Added click-outside handler and pathname reset
- ~~Meta-learning SpacingCheckForm canSubmit always returns true (TODO never implemented)~~ FIXED: Now checks focused_session timestamp against minimumTimeGapSeconds with contextual feedback
- ~~Language assessment handleNext navigates even if submission fails~~ FIXED: handleSubmitAnswer returns boolean, handleNext stops on failure
- ~~Golem credit missing from README (critical per audit Section 5.1)~~ FIXED: Added Acknowledgements section
- ~~Lite page has 7 debug console.log statements in production code~~ FIXED: Removed all debug logs and debug useEffect

## Remaining known issues (not code bugs)

- Admin API endpoints missing auth checks (TODOs in route files) — low risk since admin routes require separate access
- Multiple console.log statements in auth page, review page, sidebar — lower priority, not user-facing pages
- 4 M3 entity types missing schema docs (per audit): learner_quest_assessment_result, quest_completion_skill_link, quest_reflection, quest_telemetry
- Passkey wallet uses fixed salt (TODO: per-user salt in production)
