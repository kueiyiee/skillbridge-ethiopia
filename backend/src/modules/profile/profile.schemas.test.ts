import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { profileUpdateSchema } from './profile.schemas';

const validProfile = {
  firstName: 'System',
  middleName: '',
  lastName: 'Administrator',
  username: 'admin@skillbridge.ss',
  phone: '',
  dateOfBirth: '',
  gender: '',
  genderDescription: '',
  country: 'Ethiopia',
  region: '',
  city: '',
  headline: '',
  bio: '',
  preferredLanguage: 'en',
  portfolioUrl: '',
  linkedinUrl: '',
  website: '',
  profileVisibility: 'PRIVATE',
  showPhone: false,
  showEmail: false,
  showLocation: false,
  showGender: false,
  candidateSearchable: false,
  employerDiscoverable: false,
};

describe('profile update schema', () => {
  it('accepts the provisioned admin email as a username', () => {
    const result = profileUpdateSchema.safeParse(validProfile);
    assert.equal(result.success, true);
  });

  it('continues to accept regular usernames and empty optional usernames', () => {
    assert.equal(profileUpdateSchema.safeParse({ ...validProfile, username: 'admin_user' }).success, true);
    assert.equal(profileUpdateSchema.safeParse({ ...validProfile, username: '' }).success, true);
  });

  it('rejects malformed email-style usernames with a useful field error', () => {
    const result = profileUpdateSchema.safeParse({ ...validProfile, username: 'admin@' });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.issues[0].message, /valid email-style username/);
  });
});