import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const localesDir = path.join(root, 'locales');
const locales = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw || '{}');
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const mergeMissing = (target, source) => {
  let changed = false;
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) {
      target[key] = value;
      changed = true;
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      changed = mergeMissing(target[key], value) || changed;
    }
  }
  return changed;
};

const commonPath = (locale) => path.join(localesDir, locale, 'common.json');
const chatPath = (locale) => path.join(localesDir, locale, 'chat.json');
const languagesPath = (locale) => path.join(localesDir, locale, 'languages.json');

const enCommon = readJson(commonPath('en'));
enCommon.error ??= 'Error';
enCommon.network_error ??= 'No internet connection. Please check and try again.';
enCommon.server_error_default ??= 'Something went wrong. Please try again later.';
enCommon.select_optional ??= 'Select (optional)';
enCommon.select_limit_2_ethnicity ??= 'Select ethnic group (max 2)';
enCommon.maslak_school ??= 'Maslak / School of Thought';
enCommon.following_movement ??= 'Following / Movement';
enCommon.how_practising ??= 'How Practising Are You?';
Object.assign(enCommon, {
  account: enCommon.account ?? 'Account',
  active: enCommon.active ?? 'Active',
  active_sessions_count: enCommon.active_sessions_count ?? '{{count}} active session(s)',
  add_photo_number: enCommon.add_photo_number ?? 'Add photo {{number}}',
  all_sessions_revoke_failed: enCommon.all_sessions_revoke_failed ?? 'Could not log out all devices. Please try again.',
  all_sessions_revoked: enCommon.all_sessions_revoked ?? 'You have been logged out on all devices.',
  amount: enCommon.amount ?? 'Amount',
  block: enCommon.block ?? 'Block',
  block_user_confirm: enCommon.block_user_confirm ?? 'Are you sure you want to block this user?',
  blocked_label: enCommon.blocked_label ?? 'Blocked',
  company_invalid_chars: enCommon.company_invalid_chars ?? 'Company name can only contain letters, numbers, spaces and basic punctuation.',
  current_membership: enCommon.current_membership ?? 'Current membership',
  filter_data_unavailable: enCommon.filter_data_unavailable ?? 'Some filter data is unavailable. Please try again.',
  gallery_photo_deleted_success: enCommon.gallery_photo_deleted_success ?? 'Photo removed successfully.',
  gallery_photo_uploaded_success: enCommon.gallery_photo_uploaded_success ?? 'Photo uploaded successfully.',
  i_usually_dress: enCommon.i_usually_dress ?? 'I usually dress',
  is_practising: enCommon.is_practising ?? 'Practising',
  language_reload_note: enCommon.language_reload_note ?? 'The app reloads after changing language so layout and translations update correctly.',
  logout_all_devices_hint: enCommon.logout_all_devices_hint ?? 'End every session and return to login on this phone.',
  logout_other_devices_hint: enCommon.logout_other_devices_hint ?? 'Keep this phone signed in and remove every other session.',
  microphone_permission_required: enCommon.microphone_permission_required ?? 'Microphone permission is required.',
  no_favourites: enCommon.no_favourites ?? 'No favourites yet',
  no_favourites_hint: enCommon.no_favourites_hint ?? 'Profiles you save while exploring will appear here.',
  no_messages_yet: enCommon.no_messages_yet ?? 'No messages yet',
  no_visited_hint: enCommon.no_visited_hint ?? 'Profiles you view will appear here.',
  no_visitors_hint: enCommon.no_visitors_hint ?? 'When someone views your profile, they will show up here.',
  photo_permission_required: enCommon.photo_permission_required ?? 'Photo library permission is required.',
  preferences: enCommon.preferences ?? 'Preferences',
  recording_failed: enCommon.recording_failed ?? 'Could not start recording.',
  recording_too_short: enCommon.recording_too_short ?? 'Recording is too short.',
  rotate: enCommon.rotate ?? 'Rotate',
  save_profile: enCommon.save_profile ?? 'Save profile',
  security_privacy: enCommon.security_privacy ?? 'Security & privacy',
  select_currency: enCommon.select_currency ?? 'Select currency',
  select_designation: enCommon.select_designation ?? 'Select designation',
  select_occupation: enCommon.select_occupation ?? 'Select occupation',
  send_text_first: enCommon.send_text_first ?? 'Send a text message first, then attach media.',
  skip: enCommon.skip ?? 'Skip',
  start_free_trial: enCommon.start_free_trial ?? 'Start free trial',
  visitor_label: enCommon.visitor_label ?? 'Visitor',
  web_handoff_required: enCommon.web_handoff_required ?? 'Paid checkout will use secure web handoff after the one-time session endpoint is implemented.',
  'profile.alcohol': enCommon['profile.alcohol'] ?? 'Alcohol',
  'profile.annual_income': enCommon['profile.annual_income'] ?? 'Annual income',
  'profile.appearance': enCommon['profile.appearance'] ?? 'Appearance',
  'profile.bio_placeholder': enCommon['profile.bio_placeholder'] ?? 'Share brief description to help others understand you better.',
  'profile.born_muslim': enCommon['profile.born_muslim'] ?? 'Born Muslim',
  'profile.company': enCommon['profile.company'] ?? 'Company',
  'profile.complexion': enCommon['profile.complexion'] ?? 'Complexion',
  'profile.current_location': enCommon['profile.current_location'] ?? 'Current location',
  'profile.designation': enCommon['profile.designation'] ?? 'Designation',
  'profile.edit_inline_above': enCommon['profile.edit_inline_above'] ?? 'Use the editable section above to update this field.',
  'profile.education': enCommon['profile.education'] ?? 'Education',
  'profile.ethnic_group': enCommon['profile.ethnic_group'] ?? 'Ethnic group',
  'profile.field_editor_unavailable': enCommon['profile.field_editor_unavailable'] ?? 'Options are still loading. Please try again.',
  'profile.following': enCommon['profile.following'] ?? 'Following / Movement',
  'profile.future_plans': enCommon['profile.future_plans'] ?? 'Future plans',
  'profile.grew_up_in': enCommon['profile.grew_up_in'] ?? 'Grew up in',
  'profile.have_children': enCommon['profile.have_children'] ?? 'Have children',
  'profile.headline_placeholder': enCommon['profile.headline_placeholder'] ?? 'Write a headline for this profile',
  'profile.height': enCommon['profile.height'] ?? 'Height',
  'profile.i_usually_dress': enCommon['profile.i_usually_dress'] ?? 'How do you usually dress?',
  'profile.invalid_bio': enCommon['profile.invalid_bio'] ?? 'Use a shorter bio without links or unsupported characters.',
  'profile.invalid_company': enCommon['profile.invalid_company'] ?? 'Use a shorter company name without links or unsupported characters.',
  'profile.invalid_headline': enCommon['profile.invalid_headline'] ?? 'Use a shorter headline without links or unsupported characters.',
  'profile.is_practising': enCommon['profile.is_practising'] ?? 'How practising are you?',
  'profile.languages_spoken': enCommon['profile.languages_spoken'] ?? 'Languages spoken',
  'profile.lifestyle': enCommon['profile.lifestyle'] ?? 'Lifestyle',
  'profile.load_error': enCommon['profile.load_error'] ?? 'Could not load profile.',
  'profile.location': enCommon['profile.location'] ?? 'Location',
  'profile.marital_status': enCommon['profile.marital_status'] ?? 'Marital status',
  'profile.marriage_plan': enCommon['profile.marriage_plan'] ?? 'Marriage plan',
  'profile.maslak': enCommon['profile.maslak'] ?? 'Maslak / School of thought',
  'profile.mother_tongue': enCommon['profile.mother_tongue'] ?? 'Mother tongue',
  'profile.my_profile': enCommon['profile.my_profile'] ?? 'My profile',
  'profile.nationality': enCommon['profile.nationality'] ?? 'Nationality',
  'profile.occupation': enCommon['profile.occupation'] ?? 'Occupation',
  'profile.personal_background': enCommon['profile.personal_background'] ?? 'Personal and cultural background',
  'profile.prayers': enCommon['profile.prayers'] ?? 'Prayer habit',
  'profile.professional_info': enCommon['profile.professional_info'] ?? 'Professional info',
  'profile.profile_completed': enCommon['profile.profile_completed'] ?? 'profile completed',
  'profile.profile_summary': enCommon['profile.profile_summary'] ?? 'Profile summary',
  'profile.profile_updated': enCommon['profile.profile_updated'] ?? 'Profile updated.',
  'profile.relationship_status': enCommon['profile.relationship_status'] ?? 'Relationship status',
  'profile.religious_beliefs': enCommon['profile.religious_beliefs'] ?? 'Religious beliefs',
  'profile.relocation_plans': enCommon['profile.relocation_plans'] ?? 'Relocation plans',
  'profile.sect': enCommon['profile.sect'] ?? 'Sect',
  'profile.smoking': enCommon['profile.smoking'] ?? 'Smoking',
  'profile.update_error': enCommon['profile.update_error'] ?? 'Could not update profile.',
  'profile.wants_children': enCommon['profile.wants_children'] ?? 'Wants children',
});
writeJson(commonPath('en'), enCommon);

const enChat = readJson(chatPath('en'));
enChat.accept_request_to_reply ??= 'Accept the request before replying.';
enChat.waiting_for_request_acceptance ??= 'Waiting for this request to be accepted.';
writeJson(chatPath('en'), enChat);

const enLanguages = readJson(languagesPath('en'));

for (const locale of locales.filter((locale) => locale !== 'en')) {
  const common = readJson(commonPath(locale));
  if (locale === 'es' && common.adds === 'adds') {
    delete common.adds;
  }
  if (mergeMissing(common, enCommon)) {
    writeJson(commonPath(locale), common);
  }

  const chat = readJson(chatPath(locale));
  if (mergeMissing(chat, enChat)) {
    writeJson(chatPath(locale), chat);
  }

  const languages = readJson(languagesPath(locale));
  if (mergeMissing(languages, enLanguages)) {
    writeJson(languagesPath(locale), languages);
  }
}

console.log('P0 i18n sync complete.');
