const request = require('supertest');
const app = require('../server');
const supabase = require('../lib/supabaseClient');

describe('CipherQuest Submissions API', () => {
  let testTeamId;
  let testProblemId;
  let testQuestSessionId;

  beforeAll(async () => {
    // Create a test team
    const teamRes = await request(app)
      .post('/api/auth/register')
      .send({
        teamName: `SubTestTeam${Date.now()}`,
        leadEmail: `subtest${Date.now()}@cipherquest.com`,
        password: 'password123'
      });
    
    testTeamId = teamRes.body.teamId;

    // Verify email
    await supabase
      .from('teams')
      .update({ email_verified: true })
      .eq('id', testTeamId);

    // Get a problem statement
    const { data: problems } = await supabase
      .from('problem_statements')
      .select('id')
      .limit(1)
      .single();
    
    testProblemId = problems.id;

    // Create a quest session
    const { data: questSession } = await supabase
      .from('quest_sessions')
      .insert([
        {
          team_id: testTeamId,
          questions: [],
          correct_answers: 4,
          is_completed: true,
          assigned_problem_id: testProblemId
        }
      ])
      .select()
      .single();
    
    testQuestSessionId = questSession.id;
  });

  afterAll(async () => {
    // Clean up
    if (testTeamId) {
      await supabase
        .from('submissions')
        .delete()
        .eq('team_id', testTeamId);
      
      await supabase
        .from('quest_sessions')
        .delete()
        .eq('team_id', testTeamId);
      
      await supabase
        .from('teams')
        .delete()
        .eq('id', testTeamId);
    }
  });

  describe('GET /api/submissions/problem/:teamId', () => {
    it('should get assigned problem for qualified team', async () => {
      const res = await request(app)
        .get(`/api/submissions/problem/${testTeamId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('problem');
      expect(res.body.problem).toHaveProperty('title');
      expect(res.body.problem).toHaveProperty('description');
    });

    it('should not get problem for unqualified team', async () => {
      // Create unqualified team
      const unqualifiedRes = await request(app)
        .post('/api/auth/register')
        .send({
          teamName: `UnqualifiedTeam${Date.now()}`,
          leadEmail: `unqualified${Date.now()}@cipherquest.com`,
          password: 'password123'
        });
      
      const unqualifiedId = unqualifiedRes.body.teamId;
      
      await supabase
        .from('teams')
        .update({ email_verified: true })
        .eq('id', unqualifiedId);

      const res = await request(app)
        .get(`/api/submissions/problem/${unqualifiedId}`);
      
      expect(res.statusCode).toEqual(404);

      // Clean up
      await supabase
        .from('teams')
        .delete()
        .eq('id', unqualifiedId);
    });
  });

  describe('POST /api/submissions/submit', () => {
    it('should submit project successfully', async () => {
      const res = await request(app)
        .post('/api/submissions/submit')
        .send({
          teamId: testTeamId,
          pptUrl: 'https://drive.google.com/ppt-link',
          prototypeUrl: 'https://github.com/team/prototype',
          githubUrl: 'https://github.com/team/repo',
          description: 'This is our CipherQuest project submission'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('submission successful');
      expect(res.body.submission).toHaveProperty('id');
    });

    it('should update existing submission', async () => {
      const res = await request(app)
        .post('/api/submissions/submit')
        .send({
          teamId: testTeamId,
          pptUrl: 'https://drive.google.com/updated-ppt',
          prototypeUrl: 'https://github.com/team/updated-prototype',
          githubUrl: 'https://github.com/team/updated-repo',
          description: 'Updated project submission'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.submission.ppt_url).toContain('updated-ppt');
    });
  });

  describe('GET /api/submissions/status/:teamId', () => {
    it('should get submission status', async () => {
      const res = await request(app)
        .get(`/api/submissions/status/${testTeamId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('hasSubmitted', true);
      expect(res.body.submission).toHaveProperty('description');
    });
  });

  describe('GET /api/submissions/deadline', () => {
    it('should get submission deadline', async () => {
      const res = await request(app)
        .get('/api/submissions/deadline');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('deadline');
      expect(res.body).toHaveProperty('timeRemaining');
    });
  });

  describe('GET /api/submissions/guidelines', () => {
    it('should get submission guidelines', async () => {
      const res = await request(app)
        .get('/api/submissions/guidelines');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('guidelines');
      expect(res.body).toHaveProperty('title');
    });
  });
});
