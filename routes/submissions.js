const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// Get problem statement for CipherQuest qualified team
router.get('/problem/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team's quest session to find assigned problem
    const { data: questSession, error: sessionError } = await supabase
      .from('quest_sessions')
      .select('assigned_problem_id')
      .eq('team_id', teamId)
      .single();

    if (sessionError || !questSession?.assigned_problem_id) {
      return res.status(404).json({ 
        error: 'No problem statement assigned. Complete CipherQuest first.' 
      });
    }

    // Get problem statement
    const { data: problem, error: problemError } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('id', questSession.assigned_problem_id)
      .single();

    if (problemError) throw problemError;

    // Get submission deadline
    const deadline = problem.submission_deadline;
    const timeRemaining = new Date(deadline) - new Date();

    res.json({ 
      problem,
      submissionInfo: {
        deadline: deadline,
        timeRemaining: Math.max(0, timeRemaining),
        isOverdue: timeRemaining < 0
      }
    });
  } catch (error) {
    console.error('Get CipherQuest problem error:', error);
    res.status(500).json({ error: 'Failed to get problem statement' });
  }
});

// Submit project for CipherQuest
router.post('/submit', async (req, res) => {
  try {
    const { teamId, pptUrl, prototypeUrl, githubUrl, description } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Check if team is qualified and has problem statement
    const { data: questSession, error: sessionError } = await supabase
      .from('quest_sessions')
      .select('assigned_problem_id, correct_answers, score')
      .eq('team_id', teamId)
      .single();

    if (sessionError || !questSession?.assigned_problem_id) {
      return res.status(400).json({ 
        error: 'Team not qualified for submission. Complete CipherQuest with 3+ correct answers.' 
      });
    }

    // Check if already submitted
    const { data: existingSubmission, error: existingError } = await supabase
      .from('submissions')
      .select('id')
      .eq('team_id', teamId)
      .single();

    let submission;
    if (existingSubmission) {
      // Update existing submission
      const { data, error } = await supabase
        .from('submissions')
        .update({
          ppt_url: pptUrl,
          prototype_url: prototypeUrl,
          github_url: githubUrl,
          description: description,
          submission_time: new Date().toISOString(),
          is_submitted: true
        })
        .eq('id', existingSubmission.id)
        .select()
        .single();

      if (error) throw error;
      submission = data;
    } else {
      // Create new submission
      const { data, error } = await supabase
        .from('submissions')
        .insert([
          {
            team_id: teamId,
            problem_id: questSession.assigned_problem_id,
            ppt_url: pptUrl,
            prototype_url: prototypeUrl,
            github_url: githubUrl,
            description: description,
            is_submitted: true,
            quest_completion_time: await getQuestCompletionTime(teamId)
          }
        ])
        .select()
        .single();

      if (error) throw error;
      submission = data;
    }

    // Update team stage to 3 (submission completed)
    await supabase
      .from('teams')
      .update({ current_stage: 3 })
      .eq('id', teamId);

    res.json({
      message: 'CipherQuest submission successful! Your project is now under review.',
      submission,
      nextSteps: 'Wait for judging results on the leaderboard.'
    });
  } catch (error) {
    console.error('CipherQuest submission error:', error);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// Get submission status
router.get('/status/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ 
      submission: submission || null,
      hasSubmitted: !!submission?.is_submitted
    });
  } catch (error) {
    console.error('Get CipherQuest submission status error:', error);
    res.status(500).json({ error: 'Failed to get submission status' });
  }
});

// Get submission deadline for CipherQuest
router.get('/deadline', async (req, res) => {
  try {
    const { data: problem, error } = await supabase
      .from('problem_statements')
      .select('submission_deadline, title')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    const deadline = problem?.submission_deadline;
    const timeRemaining = deadline ? new Date(deadline) - new Date() : 0;

    res.json({ 
      deadline: deadline,
      timeRemaining: Math.max(0, timeRemaining),
      title: problem?.title || 'CipherQuest Submission'
    });
  } catch (error) {
    console.error('Get CipherQuest deadline error:', error);
    res.status(500).json({ error: 'Failed to get deadline' });
  }
});

// Get submission guidelines
router.get('/guidelines', async (req, res) => {
  try {
    const { data: problem, error } = await supabase
      .from('problem_statements')
      .select('guidelines, title')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    res.json({
      title: problem?.title || 'CipherQuest Project',
      guidelines: problem?.guidelines || 'Submit your PPT and prototype link as per the problem requirements.'
    });
  } catch (error) {
    console.error('Get CipherQuest guidelines error:', error);
    res.status(500).json({ error: 'Failed to get guidelines' });
  }
});

// Helper function to get quest completion time
async function getQuestCompletionTime(teamId) {
  try {
    const { data: questSession, error } = await supabase
      .from('quest_sessions')
      .select('started_at, completed_at')
      .eq('team_id', teamId)
      .single();

    if (error || !questSession?.completed_at) return null;

    const startTime = new Date(questSession.started_at);
    const completedTime = new Date(questSession.completed_at);
    return Math.round((completedTime - startTime) / 1000); // Return in seconds
  } catch (error) {
    console.error('Get quest completion time error:', error);
    return null;
  }
}

module.exports = router;
