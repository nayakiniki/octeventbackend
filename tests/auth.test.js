const request = require('supertest');
const app = require('../server');
const supabase = require('../lib/supabaseClient');

describe('CipherQuest Authentication API', () => {
  let testTeamId;
  const testEmail = `test${Date.now()}@cipherquest.com`;
  const testTeamName = `CipherTest${Date.now()}`;

  beforeAll(async () => {
    // Clean up any existing test data
    await supabase
      .from('teams')
      .delete()
      .like('team_name', 'CipherTest%');
  });

  afterAll(async () => {
    // Clean up test data
    if (testTeamId) {
      await supabase
        .from('teams')
        .delete()
        .eq('id', testTeamId);
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new team for CipherQuest', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: testTeamName,
          leadEmail: testEmail,
          password: 'cipher123',
          teamMembers: ['Alice', 'Bob', 'Charlie']
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('teamId');
      expect(res.body.message).toContain('CipherQuest');
      
      testTeamId = res.body.teamId;
    });

    it('should not register duplicate team name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: testTeamName,
          leadEmail: 'different@email.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('already registered');
    });

    it('should not register with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: 'IncompleteTeam'
          // Missing email and password
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should not login unverified email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'cipher123'
        });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('needsVerification');
    });

    it('should not login with wrong password', async () => {
      // First verify the email manually for testing
      await supabase
        .from('teams')
        .update({ email_verified: true })
        .eq('id', testTeamId);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword'
        });
      
      expect(res.statusCode).toEqual(401);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'cipher123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('team');
      expect(res.body.team.team_name).toEqual(testTeamName);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // Get the verification token
      const { data: team } = await supabase
        .from('teams')
        .select('verification_token')
        .eq('id', testTeamId)
        .single();

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          token: team.verification_token
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('verified successfully');
    });

    it('should not verify with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          token: 'invalid-token-123'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should accept password reset request for valid email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testEmail
        });
      
      expect(res.statusCode).toEqual(200);
    });

    it('should not fail for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@cipherquest.com'
        });
      
      expect(res.statusCode).toEqual(200);
    });
  });
});
