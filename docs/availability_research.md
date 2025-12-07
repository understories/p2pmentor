# Availability Feature Research & Recommendations

**Date**: Current session  
**Goal**: Working beta this week to start onboarding users  
**Decision Needed**: Calendar API integration vs simple text-based approach

---

## Current State

### Mentor-Graph Implementation (Reference)
- **Approach**: Simple text-based `availabilityWindow` field
- **Examples**: 
  - "Mon-Fri 9am-5pm EST"
  - "Weekends 10am-2pm EST"
  - "Flexible"
- **Storage**: Stored in offer entity payload as a string
- **UI**: Simple text input field
- **No calendar API integration**

### Current p2pmentor Status
- Offers already include `availabilityWindow` field (text-based)
- Availability page is placeholder
- Need to decide: enhance with calendar UI or keep simple?

---

## Option 1: Simple Text-Based (Mentor-Graph Approach)

### Implementation
- Text input/textarea for availability description
- Store as string in profile or separate availability entity
- Display in offers and profile

### Pros
- ✅ **Fast**: 1-2 hours to implement
- ✅ **No dependencies**: No external APIs or libraries
- ✅ **No costs**: Completely free
- ✅ **Proven**: Works well in mentor-graph
- ✅ **Flexible**: Users can describe availability in natural language
- ✅ **No debugging complexity**: Simple string storage/retrieval
- ✅ **Beta-ready**: Can ship today

### Cons
- ❌ No structured calendar data
- ❌ No automatic conflict detection
- ❌ No calendar sync
- ❌ Manual updates required

### Development Estimate
- **Implementation**: 1-2 hours
- **Testing**: 30 minutes
- **Total**: ~2 hours

### Code Complexity
- **Low**: Simple form + string storage
- **Debugging**: Minimal (just form validation)

---

## Option 2: Open Source Calendar Component (DayPilot Lite)

### Implementation
- Integrate DayPilot Lite React component
- Visual calendar UI for selecting availability
- Store structured time slots in Arkiv
- Display calendar view in profile/offers

### Pros
- ✅ **Free & Open Source**: DayPilot Lite is MIT licensed
- ✅ **Visual UI**: Better UX than text input
- ✅ **Structured Data**: Can store actual time slots
- ✅ **Self-hosted**: No external API dependencies
- ✅ **Customizable**: Can adapt to our design

### Cons
- ❌ **Time Investment**: 2-4 days for integration
- ❌ **Learning Curve**: Need to learn DayPilot API
- ❌ **Complexity**: More code to maintain
- ❌ **Beta Risk**: May delay launch if issues arise

### Development Estimate
- **Research & Setup**: 4-6 hours
- **Integration**: 1-2 days
- **Customization**: 1 day
- **Testing & Debugging**: 4-6 hours
- **Total**: 2-4 days

### Code Complexity
- **Medium**: React component integration + data transformation
- **Debugging**: Moderate (component quirks, timezone handling)

---

## Option 3: Calendar API Integration (Cal.com / Google Calendar)

### Implementation
- OAuth flow for calendar access
- API integration for reading/writing events
- Sync availability from external calendar
- Display in app

### Pros
- ✅ **Real-time Sync**: Automatic updates from user's calendar
- ✅ **Professional**: Industry-standard approach
- ✅ **Conflict Detection**: Can check actual calendar events

### Cons
- ❌ **High Complexity**: OAuth, API calls, error handling
- ❌ **Cost Risk**: Cal.com has paid tiers, Google has rate limits
- ❌ **Time Investment**: 3-5 days minimum
- ❌ **External Dependencies**: Relies on third-party services
- ❌ **Beta Risk**: High - many moving parts can break
- ❌ **Privacy Concerns**: Users must grant calendar access

### Development Estimate
- **OAuth Setup**: 1 day
- **API Integration**: 2-3 days
- **Error Handling**: 1 day
- **Testing & Debugging**: 1 day
- **Total**: 5-7 days minimum

### Code Complexity
- **High**: OAuth flows, API error handling, token refresh, rate limiting
- **Debugging**: High (OAuth issues, API errors, timezone bugs, sync conflicts)

---

## Option 4: Hybrid Approach (Phase 1 + Phase 2)

### Phase 1 (Beta Launch - This Week)
- Simple text-based availability (Option 1)
- Quick to ship, gets users onboarded
- **Time**: 2 hours

### Phase 2 (Post-Beta)
- Evaluate user feedback
- Add calendar UI if needed (Option 2)
- Or add calendar sync if demand exists (Option 3)

---

## Recommendation: **Option 1 (Simple Text-Based) for Beta**

### Rationale

1. **Timeline**: Beta launch this week is the priority
   - Option 1: Ship in 2 hours ✅
   - Option 2: 2-4 days (risks missing beta deadline) ⚠️
   - Option 3: 5-7 days (definitely misses beta deadline) ❌

2. **Risk Assessment**:
   - Option 1: Low risk, proven approach
   - Option 2: Medium risk, new dependency
   - Option 3: High risk, many failure points

3. **User Value**:
   - For beta, text-based is sufficient
   - Users can describe availability clearly
   - Can upgrade later based on feedback

4. **Cost**:
   - Option 1: $0, no ongoing costs
   - Option 2: $0, but time investment
   - Option 3: Potential API costs, OAuth complexity

5. **Maintenance**:
   - Option 1: Minimal maintenance
   - Option 2: Component updates, potential breaking changes
   - Option 3: API changes, OAuth token management, rate limits

### Implementation Plan

**Phase 1 (Beta - This Week)**:
1. Create availability management page with text input
2. Store availability in user profile (or separate entity)
3. Display in profile and offers
4. **Time**: 2 hours
5. **Ship**: Today

**Phase 2 (Post-Beta - If Needed)**:
1. Gather user feedback on availability feature
2. If users request calendar UI: Consider DayPilot Lite (2-4 days)
3. If users request calendar sync: Consider Cal.com API (5-7 days)
4. Make decision based on actual user needs

---

## Comparison Table

| Factor | Option 1: Text | Option 2: DayPilot | Option 3: API |
|--------|----------------|-------------------|---------------|
| **Development Time** | 2 hours | 2-4 days | 5-7 days |
| **Cost** | $0 | $0 | Potential costs |
| **Complexity** | Low | Medium | High |
| **Debugging Time** | Minimal | Moderate | High |
| **Beta Ready** | ✅ Today | ⚠️ 2-4 days | ❌ 5-7 days |
| **User Experience** | Good | Better | Best |
| **Maintenance** | Low | Medium | High |
| **Risk** | Low | Medium | High |

---

## Final Recommendation

**For Beta Launch (This Week)**: Implement **Option 1 (Simple Text-Based)**

**Reasons**:
1. ✅ Meets beta deadline (2 hours vs days)
2. ✅ Proven approach (mentor-graph uses it successfully)
3. ✅ Low risk, high reliability
4. ✅ Can iterate based on user feedback
5. ✅ No external dependencies or costs

**Post-Beta**: Re-evaluate based on user feedback. If calendar UI is requested, DayPilot Lite (Option 2) is a good open-source choice.

---

## Next Steps

1. ✅ Research complete
2. ⏳ Await decision from team
3. ⏳ Implement chosen approach
4. ⏳ Ship with beta launch

