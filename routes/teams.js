const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// Get CipherQuest dashboard
router.get('/dashboard/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team basic info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    // Get quest session progress
    const { data: questSession, error: questError } = await supabase
      .from('quest_sessions')
      .select('*')
      .eq('team_id', teamId)
      .single();

    // Get submission status
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', teamId)
      .single();

    // Get judging scores if available
    const { data: scores, error: scoresError } = await supabase
      .from('judging_scores')
      .select('*')
      .eq('team_id', teamId)
      .single();

    // Get assigned problem if qualified
    let assignedProblem = null;
    if (questSession?.assigned_problem_id) {
      const { data: problem, error: problemError } = await supabase
        .from('problem_statements')
        .select('*')
        .eq('id', questSession.assigned_problem_id)
        .single();
      
      if (!problemError) assignedProblem = problem;
    }

    const dashboard = {
      teamInfo: {
        id: team.id,
        team_name: team.team_name,
        lead_email: team.lead_email,
        team_members: team.team_members,
        current_stage: team.current_stage,
        is_disqualified: team.is_disqualified,
        quest_score: team.quest_score
      },
      stageStatus: {
        stage1: {
          name: 'Cipher Quest',
          completed: !!questSession?.is_completed,
          score: questSession?.score || 0,
          correctAnswers: questSession?.correct_answers || 0,
          qualified: questSession?.correct_answers >= 3,
          timeTaken: submission?.quest_completion_time || 0
        },
        stage2: {
          name: 'Build & Submit',
          completed: !!submission?.is_submitted,
          submission: submission || null,
          assignedProblem: assignedProblem
        },
        stage3: {
          name: 'Finals & Leaderboard',
          completed: !!scores,
          scores: scores || null
        }
      },
      progress: {
        cipherScore: questSession?.correct_answers || 0,
        submissionMade: !!submission?.is_submitted,
        judged: !!scores,
        finalScore: scores?.total_score || 0,
        overallProgress: calculateProgress(team.current_stage, !!submission?.is_submitted, !!scores)
      }
    };

    res.json({ dashboard });
  } catch (error) {
    console.error('Get CipherQuest dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// Update team profile
router.put('/profile/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { teamMembers } = req.body;

    if (!teamMembers || !Array.isArray(teamMembers)) {
      return res.status(400).json({ error: 'Team members array is required' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update({
        team_members: teamMembers,
        updated_at: new Date().toISOString()
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'CipherQuest profile updated successfully',
      team
    });
  } catch (error) {
    console.error('Update CipherQuest profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get team progress
router.get('/progress/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('current_stage, is_disqualified, quest_score')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { data: questSession, error: questError } = await supabase
      .from('quest_sessions')
      .select('correct_answers, is_completed')
      .eq('team_id', teamId)
      .single();

    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('is_submitted')
      .eq('team_id', teamId)
      .single();

    res.json({
      currentStage: team.current_stage,
      isDisqualified: team.is_disqualified,
      questScore: team.quest_score,
      cipherProgress: {
        completed: questSession?.is_completed || false,
        correctAnswers: questSession?.correct_answers || 0,
        qualified: (questSession?.correct_answers || 0) >= 3
      },
      submissionMade: submission?.is_submitted || false,
      canProceed: !team.is_disqualified && team.current_stage > 1
    });
  } catch (error) {
    console.error('Get team progress error:', error);
    res.status(500).json({ error: 'Failed to get team progress' });
  }
});

// Helper function to calculate overall progress
function calculateProgress(currentStage, submissionMade, judged) {
  if (judged) return 100;
  if (submissionMade) return 66;
  if (currentStage >= 2) return 33;
  return 0;
}

module.exports = router;
