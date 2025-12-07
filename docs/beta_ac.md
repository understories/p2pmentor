# **Arkiv Acceptance Criteria for p2pmentor Beta**

This document lists the precise acceptance criteria required for the p2pmentor beta launch.
Each scenario is written in Given / When / Then format so the Arkiv team can validate functionality against the Arkiv SDK, data model, and testnet behavior.

All features below rely on standard Arkiv entity creation, query, and retrieval.
No custom RPC calls or non-documented SDK functions are assumed.

---

# **1. Authentication and Network Setup**

## **Scenario: Adding the Mendoza testnet to a wallet**

* **Given** I am on the main dashboard page
* **And** I have MetaMask installed
* **When** I click “Add Network to Wallet”
* **Then** MetaMask should open a network-add prompt
* **And** it must display the correct Mendoza testnet configuration
* **And** the network should appear in the wallet after approval

## **Scenario: Logging in with MetaMask**

* **Given** I am on the authentication page
* **When** I click “Connect MetaMask”
* **Then** my wallet should connect and return my public address
* **And** p2pmentor should store this address in state
* **And** no transactions should be required at login

## **Scenario: Logging in with Example Wallet (Server Wallet)**

* **Given** I have no wallet extension installed
* **When** I click “Log in with example wallet”
* **Then** the server should return the example wallet address
* **And** this wallet should be usable for profile creation and updates

---

# **2. Profile Creation (Arkiv Profile Entity)**

## **Scenario: Creating a new profile**

* **Given** I am on the profile creation page
* **And** I have connected a wallet (MetaMask or example wallet)
* **When** I submit the profile form
* **Then** a new Arkiv profile entity must be created
* **And** it must include all submitted fields

  * displayName
  * username
  * bio
  * timezone
  * seniority
  * contact links (optional)
  * skillsArray (may be empty)
* **And** the entity must appear on the Mendoza Explorer

## **Scenario: Viewing my profile**

* **Given** I have an existing profile entity on Arkiv
* **When** I visit the dashboard
* **Then** the app should fetch my latest profile entity
* **And** display all fields accurately
* **And** show a link to the Arkiv explorer page for transparency

---

# **3. Skills Management (skillsArray inside Profile Entity)**

## **Scenario: Adding a new skill**

* **Given** I am on the skills page
* **And** I have an existing Arkiv profile
* **When** I add a skill using the form
* **Then** a new Arkiv profile entity must be created
* **And** it must contain the updated skillsArray
* **And** duplicate skills must be prevented

## **Scenario: Removing a skill**

* **Given** my profile contains several skills
* **When** I click “remove” on a skill
* **Then** a new Arkiv profile entity must be created
* **And** the skillsArray must reflect the deletion
* **And** all other fields must be preserved

## **Scenario: Viewing skill list**

* **Given** I have multiple skills stored
* **When** I load the skills page
* **Then** I should see all skills in a grid layout
* **And** I should see the total count

---

# **4. Availability (Arkiv Availability Entity)**

## **Scenario: Adding availability blocks**

* **Given** I am on the availability page
* **And** I have an existing profile
* **When** I add availability blocks
* **Then** a new Arkiv availability entity should be created
* **And** it should include:

  * wallet address
  * selected time blocks
  * timezone

## **Scenario: Viewing my availability**

* **Given** I have availability entities on Arkiv
* **When** I load the availability page
* **Then** the system should query all my availability entities
* **And** show them grouped chronologically

---

# **5. Asks & Offers (Arkiv Ask Entity / Offer Entity)**

## **Scenario: Creating an Ask**

* **Given** I am on the Ask page
* **When** I submit “I am learning” with a topic
* **Then** an Arkiv Ask entity must be created
* **And** it must link to my wallet address
* **And** be visible in the network view

## **Scenario: Creating an Offer**

* **Given** I am on the Offer page
* **When** I submit “I am teaching” with details
* **Then** an Arkiv Offer entity must be created
* **And** include fields:

  * topic or skill
  * free/paid
  * payment address (if paid)

---

# **6. Network View (Querying Profiles, Asks, Offers)**

## **Scenario: Browsing the network**

* **Given** I am on the network page
* **When** the page loads
* **Then** the system must query Arkiv for:

  * profile entities
  * offer entities
  * ask entities
* **And** display them in a browsable list
* **And** filter results in real time

## **Scenario: Viewing a profile in the network**

* **Given** I select a profile from the network
* **When** I open the profile view
* **Then** I should see the user’s:

  * profile fields
  * skills
  * asks
  * offers
* **And** all data should be fetched directly from Arkiv

---

# **7. Meeting Workflow (Session Entity)**

## **Scenario: Requesting a meeting**

* **Given** I am viewing a profile with available offers/skills
* **When** I click “Request meeting”
* **Then** the system must create a Session entity
* **And** store:

  * requester wallet
  * mentor wallet
  * proposed time slots
  * ask/offer reference

## **Scenario: Confirming a meeting**

* **Given** a session exists with proposed times
* **When** the mentor confirms a slot
* **Then** the Session entity must update
* **And** include:

  * confirmed time
  * jitsiUrl (generated after confirmation)

## **Scenario: Paid meeting confirmation**

* **Given** a session is marked as paid
* **When** the requester enters a tx hash
* **Then** the Session entity must store that tx hash
* **And** the mentor must confirm the session again

---

# **8. Feedback (Feedback Entity)**

## **Scenario: Submitting feedback**

* **Given** a session is completed
* **When** each user leaves feedback
* **Then** a Feedback entity must be created
* **And** include:

  * from wallet
  * to wallet
  * rating
  * comment
  * sessionId

## **Scenario: Viewing feedback on profile**

* **Given** a profile has received feedback
* **When** its profile page loads
* **Then** the system must query Feedback entities
* **And** show feedback count and average rating

---

# **9. Entity Transparency (Explorer Requirements)**

For every Arkiv entity created by p2pmentor:

## **Scenario: Viewing entity transparency**

* **Given** I open an entity in the Arkiv explorer
* **When** I view the entity page
* **Then** I should see:

  * entity data
  * timestamps
  * block numbers
  * entity size
  * entity state
  * transaction and operation details
  * expiration data
  * owner address
  * gas used (aggregated cost)

*These requirements come directly from Arkiv’s expected transparency model.*

---

# **10. Beta Definition of Done**

A beta user can:

* Join using invite code
* Log in with MetaMask or Passkey (Passkey optional at end of sprint)
* Create a profile
* Add skills
* Add availability
* Create asks/offers
* Browse the network
* Request and confirm a meeting
* Enter a tx hash for paid sessions
* Join a Jitsi call
* Give mutual feedback
* Use the app on mobile comfortably
