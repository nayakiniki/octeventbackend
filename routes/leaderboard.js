const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// Get CipherQuest leaderboard
router.get('/', async (req, res) => {
  try {
    const { data: scores, error } = await supabase
      .from('judging_scores')
      .select(`
        *,
        teams (team_name, quest_score),
        submissions (description, quest_completion_time)
      `)
      .order('total_score', { ascending: false });

    if (error) throw error;

    // Format leaderboard data for CipherQuest
    const leaderboard = scores.map((score, index) => ({
      rank: index + 1,
      teamName: score.teams.team_name,
      innovationScore: score.innovation_score,
      implementationScore: score.implementation_score,
      presentationScore: score.presentation_score,
      questScore: score.teams.quest_score,
      totalScore: score.total_score,
      questTime: score.submissions.quest_completion_time,
      description: score.submissions.description,
      judgeNotes: score.judge_notes
    }));

    res.json({ 
      leaderboard,
      event: 'CipherQuest Hackathon',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get CipherQuest leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Add judging scores for CipherQuest (for admins)
router.post('/judge', async (req, res) => {
  try {
    const { teamId, submissionId, innovationScore, implementationScore, presentationScore, judgeNotes, judgedBy } = req.body;

    // Validate scores (0-100 scale)
    const scores = [innovationScore, implementationScore, presentationScore];
    if (scores.some(score => score < 0 || score > 100)) {
      return res.status(400).json({ error: 'Scores must be between 0 and 100' });
    }

    // Get team's quest score
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('quest_score')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const questScore = Math.min(team.quest_score || 0, 100); // Cap at 100
    const totalScore = Math.round(
      (innovationScore + implementationScore + presentationScore + questScore) / 4
    );

    const { data: score, error } = await supabase
      .from('judging_scores')
      .insert([
        {
          team_id: teamId,
          submission_id: submissionId,
          innovation_score: innovationScore,
          implementation_score: implementationScore,
          presentation_score: presentationScore,
          quest_score: questScore,
          total_score: totalScore,
          judge_notes: judgeNotes,
          judged_by: judgedBy
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'CipherQuest scores added successfully',
      score,
      breakdown: {
        innovation: innovationScore,
        implementation: implementationScore,
        presentation: presentationScore,
        quest: questScore,
        total: totalScore
      }
    });
  } catch (error) {
    console.error('Add CipherQuest judging scores error:', error);
    res.status(500).json({ error: 'Failed to add scores' });
  }
});

// Get top 3 teams with medals for CipherQuest
router.get('/top-teams', async (req, res) => {
  try {
    const { data: topScores, error } = await supabase
      .from('judging_scores')
      .select(`
        *,
        teams (team_name, quest_score),
        submissions (quest_completion_time)
      `)
      .order('total_score', { ascending: false })
      .limit(3);

    if (error) throw error;

    const topTeams = topScores.map((score, index) => ({
      position: index + 1,
      teamName: score.teams.team_name,
      totalScore: score.total_score,
      questScore: score.teams.quest_score,
      questTime: score.submissions.quest_completion_time,
      medal: index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze',
      color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'
    }));

    res.json({ 
      topTeams,
      event: 'CipherQuest Finals',
      announcement: 'CipherQuest 2024 Winners'
    });
  } catch (error) {
    console.error('Get CipherQuest top teams error:', error);
    res.status(500).json({ error: 'Failed to get top teams' });
  }
});

// Get CipherQuest stats
router.get('/stats', async (req, res) => {
  try {
    // Get total teams
    const { count: totalTeams, error: teamsError } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    // Get qualified teams
    const { count: qualifiedTeams, error: qualifiedError } = await supabase
      .from('quest_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('correct_answers', 3);

    // Get submitted teams
    const { count: submittedTeams, error: submittedError } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('is_submitted', true);

    // Get average quest score
    const { data: avgScore, error: avgError } = await supabase
      .from('quest_sessions')
      .select('score')
      .not('score', 'is', null);

    const averageScore = avgScore && avgScore.length > 0 
      ? Math.round(avgScore.reduce((sum, session) => sum + session.score, 0) / avgScore.length)
      : 0;

    res.json({
      stats: {
        totalTeams: totalTeams || 0,
        qualifiedTeams: qualifiedTeams || 0,
        submittedTeams: submittedTeams || 0,
        averageQuestScore: averageScore,
        qualificationRate: totalTeams ? Math.round((qualifiedTeams / totalTeams) * 100) : 0
      },
      event: 'CipherQuest 2024'
    });
  } catch (error) {
    console.error('Get CipherQuest stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
