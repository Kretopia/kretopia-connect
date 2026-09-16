# IRL Event Features for Kretopia

## ✅ Currently Implemented

### 1. **Profile QR Codes**
- Users can display their personal QR code from their profile
- Scanning the QR code:
  - **Existing users**: Instantly sends a connection request
  - **New users**: Takes to signup, then auto-connects after registration
- QR codes can be downloaded, shared, or saved
- Perfect for business card replacement at events

### 2. **Location Check-Ins** (Already Implemented)
- Partner locations have unique QR codes
- Users scan to check in and earn credits
- Tracks visit history and rewards frequent visitors
- Admin can add new locations and generate QR codes

---

## 🚀 Recommended IRL Features to Add

### 3. **Event-Specific Circles**
**Purpose**: Create temporary or permanent groups for specific events

**Features**:
- Event organizers create an event circle with unique code/QR
- Attendees scan to join the event circle
- Share updates, photos, and collaborations within the group
- Post-event: Convert to ongoing collaboration group or archive

**Use Cases**:
- Conference networking groups
- Workshop collaborators
- Festival meetup groups
- Hackathon teams

---

### 4. **Live Event Leaderboard**
**Purpose**: Gamify events and encourage engagement

**Features**:
- Real-time XP leaderboard for event attendees
- Earn points for:
  - Making new connections at the event
  - Checking in to event location
  - Posting event photos/content
  - Starting collaborations
- Display on screens at venue
- Prizes for top engagers

**Use Cases**:
- Competition at creative meetups
- Conference engagement tracking
- Networking challenge at festivals

---

### 5. **Instant Portfolio Sharing**
**Purpose**: Quick visual portfolio viewing at events

**Features**:
- Tap NFC badge or scan QR to see someone's portfolio
- Swipeable gallery view optimized for phones
- "Save to Sparks" button for later follow-up
- Works offline (caches recent portfolio items)
- "Remember this person" feature with notes

**Use Cases**:
- Art galleries and exhibitions
- Film festivals and screenings
- Music showcases
- Design conferences

---

### 6. **Event Photo Upload Station**
**Purpose**: Capture event moments and add to portfolios

**Features**:
- Event organizers set up photo upload station
- Attendees can:
  - Upload photos from the event
  - Tag collaborators in photos
  - Add to their portfolio automatically
  - Share to event circle
- Creates event highlights reel
- Credit tracking for event photography

**Use Cases**:
- Performance venues
- Art exhibitions
- Collaborative workshops
- Panel discussions

---

### 7. **Quick Collaboration Kickstart**
**Purpose**: Start projects immediately while energy is high

**Features**:
- "Start a Project" kiosk at events
- Pre-filled project templates for common event types
- Invite attendees by QR/NFC
- Set first milestone during event
- Schedule follow-up call before leaving
- Automatic project channel creation

**Use Cases**:
- Post-panel collaboration brainstorms
- Hackathon team formation
- Creative speed-dating outcomes
- Workshop follow-through

---

### 8. **Smart Business Cards**
**Purpose**: Digital business card that's better than paper

**Features**:
- Generate vCard with all profile info
- "Add to Phone Contacts" with one tap
- Auto-includes portfolio links
- Optional NFC card that links to profile
- Track who you gave cards to at events
- Follow-up reminders post-event

**Use Cases**:
- Any networking event
- Trade shows
- Client meetings
- Professional gatherings

---

### 9. **Event Check-In Streaks**
**Purpose**: Reward consistent event attendance

**Features**:
- Track attendance at recurring events
- Build streaks for weekly/monthly meetups
- Special badges for regular attendees
- "OG" status for founding members
- Exclusive benefits for streak holders
- Community building through consistency

**Use Cases**:
- Monthly creative meetups
- Weekly coworking sessions
- Regular showcase nights
- Community building

---

### 10. **Proximity Discovery**
**Purpose**: Find nearby Kretopia members at large events

**Features**:
- Opt-in location sharing during events
- See who's nearby on event map
- "Ping" nearby users you want to meet
- Filter by skills/interests you're looking for
- "Hot spots" showing where action is
- Scheduled meetup points in app

**Use Cases**:
- Large conferences (1000+ people)
- Festival grounds
- Multi-venue events
- Networking treasure hunts

---

## 🎯 Quick Implementation Priority

**Phase 1 (Immediate - For Your First Event)**:
1. ✅ Profile QR Codes (DONE)
2. Event-Specific Circles (High impact, medium effort)
3. Smart Business Cards/vCard Export (Low effort, high value)

**Phase 2 (After First Event)**:
4. Live Event Leaderboard (Great for recurring events)
5. Instant Portfolio Sharing improvements
6. Event Photo Upload

**Phase 3 (Scaling Events)**:
7. Quick Collaboration Kickstart
8. Event Check-In Streaks
9. Proximity Discovery

---

## 📱 Technical Notes

- All QR codes use the format: `kretopia.com/auth?connect={userId}` or `kretopia.com/event?join={eventId}`
- NFC tags can store same URLs for tap-to-connect
- Offline-first approach for event features (sync when connection available)
- Event mode: Special UI state optimized for quick actions
- Analytics tracking for all IRL engagement metrics

---

## 💡 Event Organizer Tools

Consider adding an "Event Organizer" dashboard:
- Create event pages
- Generate event QR codes
- Track attendance
- Manage event circles
- View engagement metrics
- Export attendee list (with permission)
- Send post-event follow-ups

This positions Kretopia as the essential tool for creative community events!
