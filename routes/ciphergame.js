const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// Start Cipher Quest
router.post('/start', async (req, res) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Check if team exists and is not disqualified
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.is_disqualified) {
      return res.status(400).json({ error: 'Team has been disqualified from CipherQuest' });
    }

    // Check if quest already exists
    const { data: existingQuest, error: questError } = await supabase
      .from('quest_sessions')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (existingQuest) {
      return res.json({
        questSession: existingQuest,
        message: 'Existing CipherQuest session found'
      });
    }

    // Get 5 random active cipher questions
    const { data: questions, error: questionsError } = await supabase
      .from('cipher_questions')
      .select('*')
      .eq('is_active', true)
      .order('random()')
      .limit(5);

    if (questionsError) throw questionsError;

    if (!questions || questions.length === 0) {
      return res.status(500).json({ error: 'No cipher questions available' });
    }

    // Create quest session
    const { data: questSession, error: sessionError } = await supabase
      .from('quest_sessions')
      .insert([
        {
          team_id: teamId,
          questions: questions,
          started_at: new Date().toISOString(),
          quest_duration: 1800 // 30 minutes in seconds
        }
      ])
      .select()
      .single();

    if (sessionError) throw sessionError;

    res.json({
      questSession,
      message: 'CipherQuest started! You have 30 minutes to solve 5 cipher challenges.',
      timer: 1800,
      totalQuestions: questions.length
    });
  } catch (error) {
    console.error('Start CipherQuest error:', error);
    res.status(500).json({ error: 'Failed to start CipherQuest' });
  }
});

// Submit Cipher guess
router.post('/guess', async (req, res) => {
  try {
    const { questSessionId, questionId, guess, teamId } = req.body;

    if (!questSessionId || !questionId || !guess || !teamId) {
      return res.status(400).json({ error: 'All fields are required: questSessionId, questionId, guess, teamId' });
    }

    // Get quest session
    const { data: questSession, error: sessionError } = await supabase
      .from('quest_sessions')
      .select('*')
      .eq('id', questSessionId)
      .eq('team_id', teamId)
      .single();

    if (sessionError || !questSession) {
      return res.status(404).json({ error: 'CipherQuest session not found' });
    }

    if (questSession.is_completed) {
      return res.status(400).json({ error: 'CipherQuest already completed' });
    }

    // Check time limit (30 minutes)
    const startTime = new Date(questSession.started_at);
    const currentTime = new Date();
    const timeElapsed = (currentTime - startTime) / 1000; // in seconds

    if (timeElapsed > questSession.quest_duration) {
      const completionData = await completeQuestSession(questSessionId, teamId, questSession.correct_answers, timeElapsed);
      return res.status(400).json({ 
        error: 'Time limit exceeded for CipherQuest',
        timeElapsed: Math.round(timeElapsed),
        completed: true,
        qualified: completionData.isQualified
      });
    }

    // Get question
    const { data: question, error: questionError } = await supabase
      .from('cipher_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return res.status(404).json({ error: 'Cipher question not found' });
    }

    // Check if question is already completed
    const { data: existingAttempt, error: attemptError } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('quest_session_id', questSessionId)
      .eq('question_id', questionId)
      .eq('team_id', teamId)
      .single();

    if (existingAttempt && existingAttempt.is_correct) {
      return res.status(400).json({ error: 'Cipher already solved' });
    }

    // Check guess (case insensitive)
    const isCorrect = guess.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
    const attempts = existingAttempt ? [...existingAttempt.attempts, guess] : [guess];

    // Save attempt
    if (existingAttempt) {
      await supabase
        .from('question_attempts')
        .update({
          attempts: attempts,
          is_correct: isCorrect,
          completed_at: isCorrect ? new Date().toISOString() : null
        })
        .eq('id', existingAttempt.id);
    } else {
      await supabase
        .from('question_attempts')
        .insert([
          {
            quest_session_id: questSessionId,
            question_id: questionId,
            team_id: teamId,
            attempts: attempts,
            is_correct: isCorrect,
            completed_at: isCorrect ? new Date().toISOString() : null
          }
        ]);
    }

    // Update quest session if correct
    if (isCorrect) {
      const newScore = questSession.score + (10 * question.difficulty);
      const newCorrectAnswers = questSession.correct_answers + 1;

      await supabase
        .from('quest_sessions')
        .update({
          score: newScore,
          correct_answers: newCorrectAnswers,
          current_question_index: Math.min(questSession.current_question_index + 1, 4)
        })
        .eq('id', questSessionId);

      // Update team quest score
      await supabase
        .from('teams')
        .update({ quest_score: newScore })
        .eq('id', teamId);

      // Check if quest is completed (3+ correct answers or all questions attempted)
      if (newCorrectAnswers >= 3 || questSession.current_question_index >= 4) {
        const completionData = await completeQuestSession(questSessionId, teamId, newCorrectAnswers, timeElapsed);
        return res.json({
          isCorrect,
          attempts: attempts.length,
          maxAttempts: question.max_attempts,
          feedback: generateCipherFeedback(guess, question.correct_answer),
          questCompleted: true,
          qualified: completionData.isQualified,
          assignedProblem: completionData.assignedProblem,
          timeElapsed: Math.round(timeElapsed),
          finalScore: newScore,
          correctAnswers: newCorrectAnswers,
          message: newCorrectAnswers >= 3 ? 
            '🎉 Congratulations! You qualified for the next stage!' : 
            '❌ Sorry, you did not qualify. Better luck next time!'
        });
      }
    }

    // Provide cipher feedback
    const feedback = generateCipherFeedback(guess, question.correct_answer);

    res.json({
      isCorrect,
      attempts: attempts.length,
      maxAttempts: question.max_attempts,
      feedback,
      timeElapsed: Math.round(timeElapsed),
      timeRemaining: Math.max(0, questSession.quest_duration - timeElapsed),
      correctAnswers: questSession.correct_answers + (isCorrect ? 1 : 0),
      totalQuestions: 5,
      message: isCorrect ? 
        '✅ Correct! Moving to next cipher...' : 
        `❌ Incorrect. ${question.max_attempts - attempts.length} attempts remaining`
    });
  } catch (error) {
    console.error('Cipher guess submission error:', error);
    res.status(500).json({ error: 'Failed to submit cipher guess' });
  }
});

// Get quest status
router.get('/status/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const { data: questSession, error: sessionError } = await supabase
      .from('quest_sessions')
      .select(`
        *,
        question_attempts (*)
      `)
      .eq('team_id', teamId)
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') {
      throw sessionError;
    }

    if (!questSession) {
      return res.status(404).json({ error: 'No active CipherQuest session found' });
    }

    // Calculate time remaining
    const startTime = new Date(questSession.started_at);
    const currentTime = new Date();
    const timeElapsed = (currentTime - startTime) / 1000;
    const timeRemaining = Math.max(0, questSession.quest_duration - timeElapsed);

    // Get current question
    const currentQuestion = questSession.questions[questSession.current_question_index];

    res.json({ 
      questSession,
      currentQuestion: {
        id: currentQuestion?.id,
        hint: currentQuestion?.hint,
        category: currentQuestion?.category,
        problem_domain: currentQuestion?.problem_domain
      },
      timeElapsed: Math.round(timeElapsed),
      timeRemaining: Math.round(timeRemaining),
      isTimeUp: timeRemaining <= 0,
      progress: {
        current: questSession.current_question_index + 1,
        total: questSession.questions.length,
        correctAnswers: questSession.correct_answers,
        qualified: questSession.correct_answers >= 3
      }
    });
  } catch (error) {
    console.error('Get CipherQuest status error:', error);
    res.status(500).json({ error: 'Failed to get quest status' });
  }
});

// Get current question
router.get('/current-question/:questSessionId', async (req, res) => {
  try {
    const { questSessionId } = req.params;

    if (!questSessionId) {
      return res.status(400).json({ error: 'Quest Session ID is required' });
    }

    const { data: questSession, error } = await supabase
      .from('quest_sessions')
      .select('questions, current_question_index, is_completed')
      .eq('id', questSessionId)
      .single();

    if (error) throw error;

    if (questSession.is_completed) {
      return res.status(400).json({ error: 'CipherQuest already completed' });
    }

    const currentQuestion = questSession.questions[questSession.current_question_index];
    
    if (!currentQuestion) {
      return res.status(404).json({ error: 'No current question found' });
    }

    res.json({
      question: {
        id: currentQuestion.id,
        hint: currentQuestion.hint,
        category: currentQuestion.category,
        problem_domain: currentQuestion.problem_domain,
        cipher_type: currentQuestion.cipher_type,
        difficulty: currentQuestion.difficulty
      },
      progress: {
        current: questSession.current_question_index + 1,
        total: questSession.questions.length,
        completed: questSession.current_question_index
      }
    });
  } catch (error) {
    console.error('Get current question error:', error);
    res.status(500).json({ error: 'Failed to get current question' });
  }
});

// Get all questions for a quest session
router.get('/questions/:questSessionId', async (req, res) => {
  try {
    const { questSessionId } = req.params;

    const { data: questSession, error } = await supabase
      .from('quest_sessions')
      .select('questions')
      .eq('id', questSessionId)
      .single();

    if (error) throw error;

    // Remove correct answers for security
    const questions = questSession.questions.map(q => ({
      id: q.id,
      hint: q.hint,
      category: q.category,
      problem_domain: q.problem_domain,
      cipher_type: q.cipher_type,
      difficulty: q.difficulty,
      max_attempts: q.max_attempts
    }));

    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Reset quest session (for testing/admin)
router.post('/reset', async (req, res) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Delete existing quest session and attempts
    await supabase
      .from('question_attempts')
      .delete()
      .eq('team_id', teamId);

    await supabase
      .from('quest_sessions')
      .delete()
      .eq('team_id', teamId);

    // Reset team stage and disqualification
    await supabase
      .from('teams')
      .update({
        current_stage: 1,
        is_disqualified: false,
        quest_score: 0
      })
      .eq('id', teamId);

    res.json({ message: 'CipherQuest reset successfully' });
  } catch (error) {
    console.error('Reset quest error:', error);
    res.status(500).json({ error: 'Failed to reset quest' });
  }
});

// Helper function to complete quest session
async function completeQuestSession(questSessionId, teamId, correctAnswers, timeElapsed = 0) {
  try {
    const isQualified = correctAnswers >= 3;
    
    // Assign problem statement based on performance and domains solved
    let assignedProblemId = null;
    if (isQualified) {
      // Get the domains of correctly solved ciphers
      const { data: solvedQuestions, error: solvedError } = await supabase
        .from('question_attempts')
        .select(`
          cipher_questions (problem_domain)
        `)
        .eq('quest_session_id', questSessionId)
        .eq('is_correct', true);

      if (!solvedError && solvedQuestions && solvedQuestions.length > 0) {
        const domains = solvedQuestions.map(sq => sq.cipher_questions.problem_domain);
        
        // Find problem statement matching the most common domain
        const { data: problems, error: problemsError } = await supabase
          .from('problem_statements')
          .select('id, domain, title')
          .eq('is_active', true)
          .in('domain', domains)
          .limit(1);

        if (!problemsError && problems && problems.length > 0) {
          assignedProblemId = problems[0].id;
          console.log(`🎯 Assigned problem to team ${teamId}: ${problems[0].title}`);
        } else {
          // Fallback to any active problem
          const { data: fallbackProblems, error: fallbackError } = await supabase
            .from('problem_statements')
            .select('id, title')
            .eq('is_active', true)
            .limit(1)
            .single();

          if (!fallbackError && fallbackProblems) {
            assignedProblemId = fallbackProblems.id;
            console.log(`🎯 Assigned fallback problem to team ${teamId}: ${fallbackProblems.title}`);
          }
        }
      }
    }

    await supabase
      .from('quest_sessions')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        assigned_problem_id: assignedProblemId
      })
      .eq('id', questSessionId);

    // Update team stage and store quest completion time
    await supabase
      .from('teams')
      .update({
        current_stage: isQualified ? 2 : 1,
        is_disqualified: !isQualified,
        updated_at: new Date().toISOString()
      })
      .eq('id', teamId);

    // Store quest completion time for qualified teams
    if (isQualified && assignedProblemId) {
      await supabase
        .from('submissions')
        .upsert([
          {
            team_id: teamId,
            problem_id: assignedProblemId,
            quest_completion_time: Math.round(timeElapsed),
            is_submitted: false
          }
        ]);
    }

    console.log(`🎮 Team ${teamId} completed CipherQuest: ${correctAnswers}/5 correct - ${isQualified ? 'QUALIFIED' : 'DISQUALIFIED'}`);

    return { isQualified, assignedProblemId };
  } catch (error) {
    console.error('Complete quest session error:', error);
    throw error;
  }
}

// Helper function for Wordle-style feedback
function generateCipherFeedback(guess, correctAnswer) {
  const feedback = [];
  const guessLetters = guess.toLowerCase().split('');
  const correctLetters = correctAnswer.toLowerCase().split('');
  const correctLetterCount = {};
  
  // Count occurrences of each letter in correct answer
  correctLetters.forEach(letter => {
    correctLetterCount[letter] = (correctLetterCount[letter] || 0) + 1;
  });

  // First pass: mark correct positions
  for (let i = 0; i < guessLetters.length; i++) {
    if (guessLetters[i] === correctLetters[i]) {
      feedback.push({ letter: guessLetters[i], status: 'correct' });
      correctLetterCount[guessLetters[i]]--;
    } else {
      feedback.push({ letter: guessLetters[i], status: 'pending' });
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < guessLetters.length; i++) {
    if (feedback[i].status === 'pending') {
      if (correctLetterCount[guessLetters[i]] > 0) {
        feedback[i].status = 'present';
        correctLetterCount[guessLetters[i]]--;
      } else {
        feedback[i].status = 'absent';
      }
    }
  }
  
  return feedback;
}

// Get leaderboard for cipher game (top scores)
router.get('/leaderboard', async (req, res) => {
  try {
    const { data: topScores, error } = await supabase
      .from('quest_sessions')
      .select(`
        score,
        correct_answers,
        teams (team_name)
      `)
      .eq('is_completed', true)
      .order('score', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboard = topScores.map((session, index) => ({
      rank: index + 1,
      teamName: session.teams.team_name,
      score: session.score,
      correctAnswers: session.correct_answers,
      accuracy: Math.round((session.correct_answers / 5) * 100)
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get cipher leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get cipher leaderboard' });
  }
});

module.exports = router;
