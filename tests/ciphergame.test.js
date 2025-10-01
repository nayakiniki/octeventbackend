const request = require('supertest');
const app = require('../server');

describe('CipherQuest Game API', () => {
  let teamId;
  let questSessionId;

  beforeAll(async () => {
    // Create a test team first
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        teamName: 'CipherTestTeam',
        leadEmail: 'ciphertest@example.com',
        password: 'password123'
      });
    
    teamId = res.body.teamId;
  });

  it('should start a cipher quest', async () => {
    const res = await request(app)
      .post('/api/cipherquest/start')
      .send({ teamId });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('questSession');
    expect(res.body.message).toContain('CipherQuest started');
    questSessionId = res.body.questSession.id;
  });

  it('should get quest status', async () => {
    const res = await request(app)
      .get(`/api/cipherquest/status/${teamId}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('questSession');
  });
});
