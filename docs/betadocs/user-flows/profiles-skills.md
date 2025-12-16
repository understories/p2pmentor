# Profiles and Skills

## Profile creation

Basic identity fields: display name, short bio and context. Availability description (simple text in beta). Profile stored as `user_profile` entity on Arkiv.

## Skills

Skills stored as part of the profile payload (`skills` array). Simple tagging rather than complex ontology in early versions.

## Design intent

Lightweight and quick to complete. Enough information for meaningful matching. Profiles describe who you are. Skills describe what you are learning or offering, not credentials or authority.

## Profile updates

Profiles are immutable - updates create new entities. Latest version is selected via query, not mutation.
