import type { DailyTime, Locale, LearningGoal, LearningStyle, SkillLevel } from "@/types/domain";

export type { Locale };

export interface Dictionary {
  common: {
    save: string;
    saved: string;
    cancel: string;
    tryAgain: string;
    loading: string;
    somethingWentWrong: string;
    back: string;
    stillWorking: string;
    sessionExpired: string;
    topicLocked: string;
    offline: string;
    aiBusy: string;
    aiUnavailable: string;
    rateLimited: string;
  };
  sidebar: {
    appName: string;
    dashboard: string;
    learn: string;
    practice: string;
    knowledgeMap: string;
    mistakes: string;
    progress: string;
    projects: string;
    interview: string;
    settings: string;
    day: string;
    days: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  landing: {
    signIn: string;
    startLearning: string;
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    topicsLine: string;
    reviewLabel: string;
    reviewYou1: string;
    reviewMentor1: string;
    reviewYou2: string;
    reviewMentor2: string;
    loopHeading: string;
    loopStages: string[];
    loopCaption: string;
    notThis1: string;
    notThis2: string;
    thisLabel: string;
    notThisText1: string;
    notThisText2: string;
    thisText: string;
    footer: string;
  };
  onboarding: {
    setUp: string;
    title: string;
    goalLabel: string;
    goals: Record<LearningGoal, string>;
    levelLabel: string;
    levels: Record<SkillLevel | "not_sure", string>;
    levelHints: Record<SkillLevel | "not_sure", string>;
    topicLabel: string;
    presetTopics: string[];
    customTopicPlaceholder: string;
    styleLabel: string;
    styles: Record<LearningStyle, string>;
    timeLabel: string;
    times: Record<DailyTime, string>;
    startDiagnostic: string;
    generatePath: string;
    enterTopicError: string;
    genericError: string;
    buildingDiagnostic: string;
    scoringAnswers: string;
    generatingPath: string;
    diagnosticFor: string;
    diagnosticTitle: string;
    diagnosticSubtitle: (count: number, subtopics: number) => string;
    questionAnswerPlaceholder: string;
    submitDiagnostic: string;
    couldNotGenerateDiagnostic: string;
    couldNotScoreDiagnostic: string;
    couldNotGeneratePath: string;
    personalize: string;
    personalizeHint: string;
    notSure: string;
    unansweredWarning: (count: number) => string;
    submitAnyway: string;
    keepAnswering: string;
    diagnosticSteps: string[];
    scoringSteps: string[];
    pathSteps: string[];
  };
  settings: {
    eyebrow: string;
    title: string;
    account: string;
    learningGoal: string;
    learningStyle: string;
    availableTime: string;
    couldNotSave: string;
    availableTimeHint: string;
    language: string;
    languageNames: Record<Locale, string>;
  };
  dashboard: {
    welcomeBack: string;
    defaultPathTitle: string;
    nextActionCopy: Record<"review" | "continue" | "start", string>;
    continueButton: string;
    masterySoFar: (mastery: string) => string;
    noActivePath: string;
    chooseTopic: string;
    overallMastery: string;
    topicsMastered: string;
    streak: string;
    xp: string;
    /** One plain sentence under each figure: what it measures and how it moves. */
    statHints: { overallMastery: string; topicsMastered: string; streak: string; xp: string };
    needsReview: string;
    viewAll: string;
    reviewButton: string;
    pathCompleteTitle: string;
    pathCompleteBody: string;
    moreReviewsDue: (count: number) => string;
  };
  learn: {
    eyebrow: string;
    noActivePath: string;
    notStarted: string;
    startNewTopic: string;
    locked: string;
    lockedRequiresLabel: string;
    upNext: string;
    topicsMastered: (mastered: number, total: number) => string;
    lockedNoticeTitle: string;
    lockedNoticeBody: string;
    backToPath: string;
    finishFirstLabel: string;
    topicsCompleted: (done: number, total: number) => string;
    strictOrderNote: string;
    lockedNoticeGoTo: (title: string) => string;
    lockedNoticePractice: string;
  };
  newPath: {
    eyebrow: string;
    title: string;
    subtitle: string;
    suggestedNext: string;
    orPickAny: string;
    alreadyTried: string;
    startButton: string;
  };
  practice: {
    eyebrow: string;
    title: string;
    subtitle: string;
    topicFilterLabel: string;
    allTopics: string;
    difficultyFilterLabel: string;
    allDifficulties: string;
    difficultyLabels: Record<"easy" | "medium" | "hard", string>;
    statusLabels: Record<"solved" | "attempted" | "unsolved", string>;
    solveButton: string;
    generateMore: string;
    generating: string;
    noProblems: string;
    noProblemsForFilter: string;
    problemsCount: (n: number) => string;
    addTopicLabel: string;
    addTopicPlaceholder: string;
    addTopicButton: string;
    couldNotGenerate: string;
    couldNotLoadTopics: string;
    noActivePath: string;
    backToBoard: string;
    topicNotReached: string;
    hiddenLocked: (count: number) => string;
  };
  session: {
    sessionLabel: string;
    practiceLabel: string;
    todaysObjective: string;
    drilling: string;
    learnObjective: (topic: string) => string;
    practiceObjective: (topic: string) => string;
    currentMastery: (mastery: number) => string;
    startSession: string;
    startPracticing: string;
    preparingConcept: string;
    reviewingAnswer: string;
    preparingExercise: string;
    startPracticingButton: string;
    preparingLesson: string;
    theoryDepthLabel: string;
    depthFull: string;
    depthFullHint: string;
    depthQuick: string;
    depthQuickHint: string;
    hideTheory: string;
    showTheory: string;
    reviseAndResubmit: string;
    nextExercise: string;
    harderVariation: string;
    sessionComplete: string;
    exercisesReviewed: (count: number, topic: string) => string;
    anotherRound: string;
    backToDashboard: string;
    backToPractice: string;
    explainReasoningPlaceholder: string;
    writeAnswerPlaceholder: string;
    submitAnswer: string;
    hint: (used: number, total: number) => string;
    hintLabel: (n: number) => string;
    noMoreHints: string;
    markSolutionRevealed: string;
    solutionMarked: string;
    stuckNote: string;
    showSolution: string;
    solutionTitle: string;
    solutionNote: string;
    couldNotLoadSolution: string;
    couldNotGenerateExercise: string;
    couldNotStartSession: string;
    couldNotEvaluate: string;
    challenge: string;
    sizedFor: (count: number, time: string) => string;
    conceptSteps: string[];
    exerciseSteps: string[];
    reviewSteps: string[];
    summaryCorrect: (correct: number, total: number) => string;
    summaryAnswers: string;
    summaryReview: string;
    summaryViewMistakes: string;
    summaryNotYet: string;
    resumeTitle: string;
    resumeDescription: (done: number, total: number) => string;
    resume: string;
    startOver: string;
    couldNotGetHint: string;
  };
  // Shared labels for exercise metadata badges (type/difficulty/hint level)
  // rendered on the Learn session, Practice board, and single-problem solve
  // views — kept in one place so any exercise-type/difficulty badge in the
  // app is translated, not just the ones with their own dedicated section.
  exercise: {
    typeLabels: Record<
      | "multiple_choice"
      | "code_prediction"
      | "code_completion"
      | "debugging"
      | "refactoring"
      | "implementation"
      | "architecture_decision"
      | "explain_code"
      | "find_the_bug"
      | "compare_implementations"
      | "optimize_code"
      | "write_tests"
      | "review_code",
      string
    >;
    difficultyLabels: Record<"easy" | "medium" | "hard" | "interview" | "real_world", string>;
    hintLevelLabels: Record<"direction" | "specific_problem" | "strong_hint", string>;
  };
  concept: {
    quickConcept: string;
    lesson: string;
    keyTakeaways: string;
    stepOf: (step: number, total: number) => string;
    back: string;
    next: string;
    quickCheck: string;
    checkCorrect: string;
    checkIncorrect: string;
    tryIt: string;
    reportProblem: string;
    reportPlaceholder: string;
    reportSend: string;
    reportSent: string;
    reportError: string;
    tryItPreview: string;
  };
  feedback: {
    resultLabels: Record<"correct" | "partially_correct" | "incorrect", string>;
    whatYouDid: string;
    problem: string;
    whyItMatters: string;
    hint: string;
    nextStep: string;
    conceptualGapDetected: string;
    revisitLesson: (heading: string) => string;
    mentorFollowUp: string;
    followUpPlaceholder: string;
    respondButton: string;
    responding: string;
    couldNotGetReaction: string;
    yourReply: string;
    mentorReaction: string;
    rewardXp: (xp: number) => string;
    rewardMastery: (from: number, to: number) => string;
    rewardAchievement: string;
    scoreBreakdown: string;
    showScores: string;
    hideScores: string;
    scoreLabels: Record<"correctness" | "logic" | "codeQuality" | "bestPractices" | "edgeCaseHandling", string>;
  };
  knowledgeMap: {
    eyebrow: string;
    noActivePath: string;
    notAttempted: string;
    reviewDue: string;
    weakestAxis: (axis: string, value: number) => string;
    axes: Record<"knowledge" | "application" | "debugging" | "explanation" | "retention", string>;
  };
  mistakes: {
    eyebrow: string;
    title: string;
    subtitle: string;
    none: string;
    unknownTopic: string;
    conceptualGap: string;
    firstSeen: (date: string) => string;
    lastSeen: (date: string) => string;
    cleanStreak: (count: number, threshold: number) => string;
    markResolved: string;
    practiceThis: string;
    resolving: string;
    recentlyResolved: string;
    resolvedOn: (date: string) => string;
  };
  progress: {
    eyebrow: string;
    title: (name: string) => string;
    overallMastery: string;
    currentStreak: string;
    longestStreak: string;
    totalXp: string;
    recentSessions: string;
    noSessions: string;
    activityTitle: string;
    activitySummary: (total: number, activeDays: number) => string;
    activityCell: (date: string, count: number) => string;
    activityLess: string;
    activityMore: string;
    sessionCompleted: string;
    sessionInProgress: string;
  };
  achievements: {
    sectionTitle: string;
    none: string;
    earnedOn: (date: string) => string;
    // Keys must match convex/lib/achievements.ts's ACHIEVEMENT_KEYS values —
    // titles/descriptions are looked up by key at render time rather than
    // stored on the row, so they always render in the viewer's current
    // locale regardless of what locale was active when earned.
    catalog: Record<
      | "first_win"
      | "perfect_five"
      | "streak_7"
      | "streak_30"
      | "first_mastery"
      | "mistake_slayer"
      | "project_shipped"
      | "xp_500"
      | "xp_2000",
      { title: string; description: string }
    >;
  };
  projects: {
    eyebrow: string;
    backToProjects: string;
    title: string;
    subtitle: string;
    noProjects: string;
    tasksCount: (done: number, total: number) => string;
    continueTask: (code: string) => string;
    allTasksDone: string;
    statusLabels: Record<"not_started" | "in_progress" | "completed", string>;
    newProject: {
      startButton: string;
      topicLabel: string;
      topicPlaceholder: string;
      levelLabel: string;
      generate: string;
      scopingTasks: string;
      buildingSteps: string[];
      cancel: string;
      enterTopicError: string;
      genericError: string;
      ideasHeading: string;
      ideasSubtitle: string;
      loadingIdeas: string;
      ideasError: string;
      refreshIdeas: string;
      buildThis: string;
      useOwnIdea: string;
      backToIdeas: string;
    };
    taskStatus: Record<"todo" | "in_review" | "changes_requested" | "done", string>;
  };
  taskRunner: {
    backToProject: string;
    nextTask: (code: string, title: string) => string;
    requirements: string;
    approved: string;
    submitForReview: string;
    resubmit: string;
    reviewing: string;
    genericError: string;
    couldNotReview: string;
    earlierSubmissions: (count: number) => string;
  };
  reviewPanel: {
    approved: string;
    changesRequested: string;
    severity: Record<"blocking" | "suggestion" | "nit", string>;
  };
  multiFileEditor: {
    preview: string;
  };
  codeEditor: {
    reset: string;
    run: string;
    running: string;
    format: string;
    formatting: string;
    error: string;
    noConsoleOutput: string;
    timedOut: string;
    preview: string;
    runTests: string;
    runningTests: string;
    testsSummary: (passed: number, total: number) => string;
    testGot: (actual: string) => string;
    testExpected: (expected: string) => string;
    testsUnavailable: string;
  };
  interview: {
    title: string;
    body1: string;
  };
  feedbackForm: {
    buttonLabel: string;
    dialogTitle: string;
    dialogDescription: string;
    categoryLabel: string;
    categoryBug: string;
    categoryIdea: string;
    categoryOther: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    submitting: string;
    sentTitle: string;
    sentBody: string;
    errorBody: string;
    close: string;
  };
}

const en: Dictionary = {
  common: {
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    tryAgain: "Try again",
    loading: "Loading…",
    somethingWentWrong: "Something went wrong.",
    back: "Back",
    stillWorking: "Still working \u2014 this can take a moment.",
    sessionExpired: "Your session has expired. Reload the page to sign in again.",
    topicLocked: "That topic isn\u2019t open yet. Finish the topics before it first.",
    offline: "Can\u2019t reach the server. Check your connection and try again.",
    aiBusy: "The AI service is having trouble right now. Try again in a moment.",
    aiUnavailable: "This feature is temporarily unavailable. Please try again later.",
    rateLimited: "You\u2019re going a bit fast. Wait a moment and try again.",
  },
  sidebar: {
    appName: "unsparing",
    dashboard: "Dashboard",
    learn: "Learn",
    practice: "Practice",
    knowledgeMap: "Knowledge Map",
    mistakes: "Mistakes",
    progress: "Progress",
    projects: "Projects",
    interview: "Interview",
    settings: "Settings",
    day: "day",
    days: "days",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
  },
  landing: {
    signIn: "Sign in",
    startLearning: "Start learning",
    eyebrow: "Practice-first, not lecture-first",
    heroTitle: 'Learn to code with a mentor who won\u2019t let you get away with \u201Cit works.\u201D',
    heroSubtitle:
      "No lecture-and-quiz cycle. You attempt real problems, a strict senior-engineer reviewer breaks down what\u2019s actually wrong, and the next problem gets harder only once you\u2019ve earned it.",
    topicsLine: "any topic \u2014 JS, React, SQL, Python, system design...",
    reviewLabel: "closures-exercise-04 \u00B7 review",
    reviewYou1: "I used a var-hoisted counter here because it was easier.",
    reviewMentor1:
      "Not sufficient. Easier in what sense \u2014 implementation time, runtime complexity, or readability? Each variable in that loop shares one binding. What happens to your callback when the loop finishes before it runs?",
    reviewYou2: "...it\u2019ll log the final value every time, not the value at creation.",
    reviewMentor2:
      "Correct diagnosis. Now fix it with a per-iteration binding \u2014 don\u2019t just swap in a library helper without saying why it solves this.",
    loopHeading: "Every topic moves through the same loop",
    loopStages: ["Understand", "Recall", "Practice", "Solve", "Explain", "Review", "Apply", "Revisit"],
    loopCaption:
      "Completion isn\u2019t \u201Cyou opened the lesson.\u201D It\u2019s demonstrated competence \u2014 measured across knowledge, application, debugging, explanation, and retention, separately, for every topic.",
    notThis1: "not this",
    notThis2: "not this",
    thisLabel: "this",
    notThisText1: "A chatbot window with a nicer theme, answering whatever you type.",
    notThisText2: "A video course that marks a topic \u201Ccomplete\u201D the moment you watch it.",
    thisText:
      "A system that continuously measures what you can actually do, finds where your understanding breaks, and builds the next problem from that.",
    footer: "unsparing \u2014 practice-first programming education",
  },
  onboarding: {
    setUp: "Set up your path",
    title: "A few questions before we start",
    goalLabel: "What\u2019s your learning goal?",
    goals: {
      first_job: "Get my first developer job",
      interview_prep: "Prepare for interviews",
      improve_skills: "Improve existing skills",
      learn_new_tech: "Learn a new technology",
      production_skills: "Build production-ready skills",
      master_topic: "Master a specific topic",
    },
    levelLabel: "What\u2019s your current level?",
    levels: {
      beginner: "Beginner",
      junior: "Junior",
      intermediate: "Intermediate",
      advanced: "Advanced",
      not_sure: "I'm not sure \u2014 test me",
    },
    levelHints: {
      beginner: "New to this, with little or no experience. Start here if you've never coded.",
      junior: "You've built small things, but the fundamentals still feel shaky.",
      intermediate: "You build real features and want to go deeper.",
      advanced: "You work with this every day and want to fill gaps or go further.",
      not_sure: "A short quiz places you. If you've never coded, choose Beginner instead \u2014 the quiz is not for first-timers.",
    },
    topicLabel: "What do you want to learn?",
    presetTopics: [
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "HTML & CSS",
      "Node.js",
      "SQL",
      "Git",
      "Python",
      "Algorithms",
      "Data Structures",
      "System Design",
      "Custom topic\u2026",
    ],
    customTopicPlaceholder: 'e.g. "React Server Components"',
    styleLabel: "Learning style",
    styles: {
      more_practice: "More practice",
      balanced: "Balanced",
      more_theory: "More theory",
    },
    timeLabel: "Available time",
    times: {
      "15min": "15 min / day",
      "30min": "30 min / day",
      "1hr": "1 hour / day",
      "2hr_plus": "2+ hours / day",
    },
    startDiagnostic: "Start diagnostic",
    generatePath: "Generate my learning path",
    enterTopicError: "Enter the topic you want to learn.",
    genericError: "Something went wrong.",
    buildingDiagnostic: "Building a diagnostic that actually covers the topic\u2026",
    scoringAnswers: "Scoring your answers\u2026",
    generatingPath: "Generating your learning path\u2026",
    diagnosticFor: "Diagnostic",
    diagnosticTitle: "Let\u2019s see where you actually stand",
    diagnosticSubtitle: (count, subtopics) =>
      `${count} questions across ${subtopics} subtopics \u2014 enough to place you accurately, not just guess. Answer as best you can; partial or uncertain answers are fine, that\u2019s useful signal too.`,
    questionAnswerPlaceholder: "Your answer\u2026",
    submitDiagnostic: "Submit diagnostic",
    couldNotGenerateDiagnostic: "Could not generate the diagnostic. Try again.",
    couldNotScoreDiagnostic: "Could not score the diagnostic. Try again.",
    couldNotGeneratePath: "Could not generate your learning path. Try again.",
    personalize: "Personalize",
    personalizeHint: "Optional \u2014 defaults are already set",
    notSure: "I don't know",
    unansweredWarning: (count) => (count === 1 ? "1 question is unanswered and will count as not known." : `${count} questions are unanswered and will count as not known.`),
    submitAnyway: "Submit anyway",
    keepAnswering: "Keep answering",
    diagnosticSteps: ["Choosing questions that fit the topic\u2026", "Mixing concept and code questions\u2026"],
    scoringSteps: ["Comparing your answers\u2026", "Estimating your level\u2026"],
    pathSteps: ["Mapping out the topics\u2026", "Ordering them by prerequisites\u2026", "Tailoring the path to your level\u2026"],
  },
  settings: {
    eyebrow: "Settings",
    title: "Profile & preferences",
    account: "Account",
    learningGoal: "Learning goal",
    learningStyle: "Learning style",
    availableTime: "Available time",
    couldNotSave: "Couldn\u2019t save that change. Your previous setting was kept.",
    availableTimeHint: "Sets how many exercises a session has. Applies from your next session.",
    language: "Language",
    languageNames: { en: "English", uk: "Ukrainian" },
  },
  dashboard: {
    welcomeBack: "Welcome back",
    defaultPathTitle: "Your learning path",
    nextActionCopy: {
      review: "Due for spaced-repetition review",
      continue: "Continue where you left off",
      start: "Start your next topic",
    },
    continueButton: "Continue",
    masterySoFar: (mastery) => `${mastery} mastery so far`,
    noActivePath: "No active learning path yet.",
    chooseTopic: "Choose a topic to start.",
    overallMastery: "Overall mastery",
    topicsMastered: "Topics mastered",
    streak: "Streak",
    xp: "XP",
    statHints: {
      overallMastery: "How well you can actually do what you've practiced, out of 100%.",
      topicsMastered: "Topics where you've reached a solid grasp.",
      streak: "Days in a row you've practiced.",
      xp: "Points for correct answers \u2014 more when you don't need hints.",
    },
    needsReview: "Needs review",
    viewAll: "View all",
    reviewButton: "Start review",
    pathCompleteTitle: "You\u2019ve completed this learning path",
    pathCompleteBody: "Every topic is done. Pick what to learn next, or keep sharpening in Practice.",
    moreReviewsDue: (count) => (count === 1 ? "1 more topic is due for review" : `${count} more topics are due for review`),
  },
  learn: {
    eyebrow: "Learning path",
    noActivePath: "No active learning path yet. Complete onboarding to generate one.",
    notStarted: "not started",
    startNewTopic: "Start a new topic",
    locked: "Locked",
    lockedRequiresLabel: "Requires:",
    upNext: "Up next",
    topicsMastered: (mastered, total) => `${mastered} of ${total} topics mastered`,
    lockedNoticeTitle: "This topic is locked",
    lockedNoticeBody: "Finish the topics before it first, and it will open.",
    backToPath: "Back to learning path",
    finishFirstLabel: "Finish first:",
    topicsCompleted: (done, total) => `${done} of ${total} topics completed`,
    strictOrderNote: "Your path opens one topic at a time, in order. Finish each to unlock the next.",
    lockedNoticeGoTo: (title) => `Go to ${title}`,
    lockedNoticePractice: "Practice opens for a topic once you\u2019ve reached it in your learning path.",
  },
  newPath: {
    eyebrow: "New learning path",
    title: "What do you want to learn next?",
    subtitle: "This starts a fresh curriculum alongside what you've already got \u2014 your progress on other topics stays exactly as it is.",
    suggestedNext: "Suggested next step",
    orPickAny: "Or pick any topic",
    alreadyTried: "(already started)",
    startButton: "Generate learning path",
  },
  practice: {
    eyebrow: "Practice",
    title: "Practice problems",
    subtitle:
      "A board of standalone problems generated from what you're currently learning — pick a difficulty and dive in, no setup required.",
    topicFilterLabel: "Topic",
    allTopics: "All topics",
    difficultyFilterLabel: "Difficulty",
    allDifficulties: "All",
    difficultyLabels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    statusLabels: { solved: "Solved", attempted: "Attempted", unsolved: "Unsolved" },
    solveButton: "Solve",
    generateMore: "Generate more problems",
    generating: "Generating problems\u2026",
    noProblems: "No problems yet \u2014 generating a first batch based on what you're learning.",
    noProblemsForFilter: "No problems match this filter yet. Try a different topic or difficulty.",
    problemsCount: (n) => `${n} problem${n === 1 ? "" : "s"}`,
    addTopicLabel: "Add a topic to the board",
    addTopicPlaceholder: 'e.g. "Python list comprehensions"',
    addTopicButton: "Add",
    couldNotGenerate: "Could not generate problems for that topic. Try again.",
    couldNotLoadTopics: "Could not load your topics.",
    noActivePath: "Complete onboarding to generate a learning path, then problems will appear here.",
    backToBoard: "Back to practice board",
    topicNotReached: "That topic is part of your learning path and you haven\u2019t reached it yet. Learn it in order first.",
    hiddenLocked: (count) => (count === 1 ? "1 problem is hidden until you reach its topic" : `${count} problems are hidden until you reach their topics`),
  },
  session: {
    sessionLabel: "Session",
    practiceLabel: "Practice",
    todaysObjective: "Today's objective",
    drilling: "Drilling",
    learnObjective: (topic) => `Understand ${topic} and correctly apply it in real code.`,
    practiceObjective: (topic) => `Coding exercises on ${topic} \u2014 no theory, straight into practice.`,
    currentMastery: (mastery) => `Current mastery: ${mastery}% \u2014 difficulty is calibrated to that automatically.`,
    startSession: "Start session",
    startPracticing: "Start practicing",
    preparingConcept: "Preparing a quick concept overview\u2026",
    reviewingAnswer: "Reviewing your answer\u2026",
    preparingExercise: "Preparing the next exercise\u2026",
    startPracticingButton: "Start practicing",
    preparingLesson: "Preparing your lesson\u2026",
    theoryDepthLabel: "Theory before you start",
    depthFull: "Full lesson",
    depthFullHint: "Step by step, assumes no background",
    depthQuick: "Quick refresher",
    depthQuickHint: "One short overview",
    hideTheory: "Hide theory",
    showTheory: "Show theory",
    reviseAndResubmit: "Revise and resubmit",
    nextExercise: "Next exercise",
    harderVariation: "Harder variation",
    sessionComplete: "Session complete",
    exercisesReviewed: (count, topic) => `${count} exercises reviewed on ${topic}.`,
    anotherRound: "Another round",
    backToDashboard: "Back to dashboard",
    backToPractice: "Back to practice",
    explainReasoningPlaceholder: "Explain your reasoning \u2014 what does this code do, and why?",
    writeAnswerPlaceholder: "Write your answer\u2026",
    submitAnswer: "Submit answer",
    hint: (used, total) => `Hint (${used}/${total})`,
    hintLabel: (n) => `Hint ${n}`,
    noMoreHints: "No more hints",
    markSolutionRevealed: "I looked up the answer (earns less XP)",
    stuckNote: "Stuck? Submit your best attempt \u2014 after the feedback you can see a worked solution.",
    showSolution: "Show the solution",
    solutionTitle: "Worked solution",
    solutionNote: "Read it, then close it and write it out yourself. Answers from here earn less XP.",
    couldNotLoadSolution: "Could not load the solution. Try again.",
    solutionMarked: "Noted \u2014 this attempt will earn less XP.",
    couldNotGenerateExercise: "Could not generate an exercise. Try again.",
    couldNotStartSession: "Could not start the session. Try again.",
    couldNotEvaluate: "Could not evaluate your answer. Try again.",
    challenge: "challenge",
    sizedFor: (count, time) => `${count} exercises, sized to your ${time}`,
    conceptSteps: ["Picking the key ideas\u2026", "Writing the examples\u2026"],
    exerciseSteps: ["Tuning the difficulty to your level\u2026", "Writing the exercise\u2026"],
    reviewSteps: ["Checking correctness and edge cases\u2026", "Writing your feedback\u2026"],
    summaryCorrect: (correct, total) => `${correct} of ${total} correct`,
    summaryAnswers: "Your answers",
    summaryReview: "Worth reviewing",
    summaryNotYet:
      "This topic isn\u2019t marked done yet \u2014 about half of your answers need to be right. Another round counts toward it, and the lesson is still there to reread.",
    summaryViewMistakes: "See all mistakes",
    resumeTitle: "Unfinished session",
    resumeDescription: (done, total) => `You've completed ${done} of ${total} exercises \u2014 pick up where you left off.`,
    resume: "Resume",
    startOver: "Start over",
    couldNotGetHint: "Could not get a hint. Try again.",
  },
  exercise: {
    typeLabels: {
      multiple_choice: "Multiple choice",
      code_prediction: "Predict the output",
      code_completion: "Code completion",
      debugging: "Debugging",
      refactoring: "Refactoring",
      implementation: "Implementation",
      architecture_decision: "Architecture decision",
      explain_code: "Explain code",
      find_the_bug: "Find the bug",
      compare_implementations: "Compare implementations",
      optimize_code: "Optimize code",
      write_tests: "Write tests",
      review_code: "Review code",
    },
    difficultyLabels: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      interview: "Interview",
      real_world: "Real world",
    },
    hintLevelLabels: {
      direction: "direction",
      specific_problem: "specific problem",
      strong_hint: "strong hint",
    },
  },
  concept: {
    quickConcept: "Quick concept",
    lesson: "Lesson",
    keyTakeaways: "Key takeaways",
    stepOf: (step, total) => `Step ${step} of ${total}`,
    back: "Back",
    next: "Next",
    quickCheck: "Quick check",
    checkCorrect: "Correct.",
    checkIncorrect: "Not quite.",
    tryIt: "Try it yourself",
    reportProblem: "Something unclear or wrong?",
    reportPlaceholder: "What was confusing or incorrect?",
    reportSend: "Send",
    reportSent: "Thanks \u2014 that helps us fix the lesson.",
    reportError: "Could not send that. Try again.",
    tryItPreview: "Live preview",
  },
  feedback: {
    resultLabels: {
      correct: "Correct",
      partially_correct: "Partially correct",
      incorrect: "Incorrect",
    },
    whatYouDid: "What you did",
    problem: "Problem",
    whyItMatters: "Why it matters",
    hint: "Hint",
    nextStep: "Next step",
    conceptualGapDetected: "Conceptual gap detected",
    revisitLesson: (heading) => `Revisit the lesson: ${heading}`,
    mentorFollowUp: "Mentor follow-up",
    followUpPlaceholder: "Answer the mentor's question\u2026",
    respondButton: "Respond",
    responding: "Sending\u2026",
    couldNotGetReaction: "Could not get a reaction. Try again.",
    yourReply: "Your reply",
    mentorReaction: "Mentor",
    rewardXp: (xp) => `+${xp} XP`,
    rewardMastery: (from, to) => `Topic mastery ${from}% \u2192 ${to}%`,
    rewardAchievement: "Achievement unlocked",
    scoreBreakdown: "Score breakdown",
    showScores: "Show detailed scores",
    hideScores: "Hide detailed scores",
    scoreLabels: {
      correctness: "Correctness",
      logic: "Logic",
      codeQuality: "Code quality",
      bestPractices: "Best practices",
      edgeCaseHandling: "Edge cases",
    },
  },
  knowledgeMap: {
    eyebrow: "Knowledge map",
    noActivePath: "No active learning path yet.",
    notAttempted: "Not attempted yet.",
    reviewDue: "Review due",
    weakestAxis: (axis, value) => `Weakest: ${axis} (${value}%)`,
    axes: {
      knowledge: "Knowledge",
      application: "Application",
      debugging: "Debugging",
      explanation: "Explanation",
      retention: "Retention",
    },
  },
  mistakes: {
    eyebrow: "Mistake database",
    title: "Recurring gaps",
    subtitle:
      "A mistake that shows up three or more times stops being a slip \u2014 it\u2019s flagged as a conceptual gap and gets prioritized in your next sessions.",
    none: "No recurring mistakes yet \u2014 nothing to review.",
    unknownTopic: "Unknown topic",
    conceptualGap: "\u2014 conceptual gap",
    firstSeen: (date) => `First seen ${date}`,
    lastSeen: (date) => `last seen ${date}`,
    cleanStreak: (count, threshold) => `${count}/${threshold} clean attempts since last seen`,
    markResolved: "Mark resolved",
    practiceThis: "Practice this",
    resolving: "Resolving\u2026",
    recentlyResolved: "Recently resolved",
    resolvedOn: (date) => `Resolved ${date}`,
  },
  progress: {
    eyebrow: "Progress",
    title: (name) => `${name}\u2019s progress`,
    overallMastery: "Overall mastery",
    currentStreak: "Current streak",
    longestStreak: "Longest streak",
    totalXp: "Total XP",
    recentSessions: "Recent sessions",
    noSessions: "No sessions yet.",
    activityTitle: "Activity, last 12 weeks",
    activitySummary: (total, activeDays) => `${total} answers on ${activeDays} active days`,
    activityCell: (date, count) => (count === 1 ? `${date}: 1 answer` : `${date}: ${count} answers`),
    activityLess: "Less",
    activityMore: "More",
    sessionCompleted: "completed",
    sessionInProgress: "in progress",
  },
  achievements: {
    sectionTitle: "Achievements",
    none: "No badges yet \u2014 keep practicing to earn your first one.",
    earnedOn: (date) => `Earned ${date}`,
    catalog: {
      first_win: { title: "First win", description: "Got your first exercise correct." },
      perfect_five: {
        title: "Five in a row",
        description: "Five correct answers in a row with no hints and no solution reveal.",
      },
      streak_7: { title: "Week streak", description: "Practiced 7 days in a row." },
      streak_30: { title: "Month streak", description: "Practiced 30 days in a row." },
      first_mastery: { title: "Mastered a topic", description: "Reached mastery on a topic for the first time." },
      mistake_slayer: { title: "Mistake slayer", description: "Resolved 5 recurring mistakes." },
      project_shipped: { title: "Shipped it", description: "Completed every task in a project." },
      xp_500: { title: "500 XP", description: "Earned 500 total XP." },
      xp_2000: { title: "2,000 XP", description: "Earned 2,000 total XP." },
    },
  },
  projects: {
    eyebrow: "Projects",
    backToProjects: "Back to projects",
    title: "Real-world builds",
    subtitle:
      "Scoped like real tickets, reviewed like a real pull request \u2014 a mentor acting as your tech lead breaks the work into tasks and reviews each submission against concrete requirements.",
    noProjects: "No projects yet \u2014 start one above.",
    tasksCount: (done, total) => `${done} / ${total} tasks`,
    continueTask: (code) => `Continue with ${code}`,
    allTasksDone: "All tasks approved",
    statusLabels: {
      not_started: "not started",
      in_progress: "in progress",
      completed: "completed",
    },
    newProject: {
      startButton: "Start a new project",
      topicLabel: "Topic",
      topicPlaceholder: 'e.g. "React" or "Node.js REST APIs"',
      levelLabel: "Level",
      generate: "Generate project",
      scopingTasks: "Scoping tasks\u2026",
      buildingSteps: ["Breaking it into tickets\u2026", "Writing the requirements\u2026", "Setting up the starter files\u2026"],
      cancel: "Cancel",
      enterTopicError: "Enter a topic for the project.",
      genericError: "Could not generate a project. Try again.",
      ideasHeading: "Pick a project idea",
      ideasSubtitle: "A few options based on what you've been learning.",
      loadingIdeas: "Coming up with ideas\u2026",
      ideasError: "Could not load suggestions \u2014 you can still describe your own idea below.",
      refreshIdeas: "New ideas",
      buildThis: "Build this",
      useOwnIdea: "Or describe your own idea",
      backToIdeas: "Back to suggestions",
    },
    taskStatus: {
      todo: "To do",
      in_review: "In review",
      changes_requested: "Changes requested",
      done: "Done",
    },
  },
  taskRunner: {
    backToProject: "Back to project",
    nextTask: (code, title) => `Next task: ${code} \u00b7 ${title}`,
    requirements: "Requirements",
    approved: "Approved \u2014 this task is done.",
    submitForReview: "Submit for review",
    resubmit: "Resubmit",
    reviewing: "Reviewing\u2026",
    genericError: "Something went wrong.",
    couldNotReview: "Could not get a review. Try again.",
    earlierSubmissions: (count) => `${count} earlier submission${count === 1 ? "" : "s"}`,
  },
  reviewPanel: {
    approved: "Approved",
    changesRequested: "Changes requested",
    severity: {
      blocking: "Blocking",
      suggestion: "Suggestion",
      nit: "Nit",
    },
  },
  multiFileEditor: {
    preview: "Preview",
  },
  codeEditor: {
    reset: "Reset",
    run: "Run",
    running: "Running\u2026",
    format: "Format",
    formatting: "Formatting\u2026",
    error: "Error",
    noConsoleOutput: "(no console output)",
    timedOut: "Timed out after 3s (possible infinite loop).",
    preview: "Preview",
    runTests: "Run tests",
    runningTests: "Running tests\u2026",
    testsSummary: (passed, total) => `${passed} of ${total} tests pass`,
    testGot: (actual) => `got ${actual}`,
    testExpected: (expected) => `expected ${expected}`,
    testsUnavailable: "Tests can't run in this browser.",
  },
  interview: {
    title: "Interview practice \u2014 coming soon",
    body1:
      "Mock interviews where the mentor asks a question, challenges your answer, follows up, and then evaluates the whole conversation. It isn\u2019t available yet.",
  },
  feedbackForm: {
    buttonLabel: "Feedback",
    dialogTitle: "Send feedback",
    dialogDescription: "Goes straight to the team's inbox \u2014 include as much detail as you can.",
    categoryLabel: "Type",
    categoryBug: "Bug",
    categoryIdea: "Idea",
    categoryOther: "Other",
    messageLabel: "Message",
    messagePlaceholder: "What happened, or what would help?",
    submit: "Send feedback",
    submitting: "Sending\u2026",
    sentTitle: "Thanks \u2014 sent!",
    sentBody: "Your feedback was emailed to the team.",
    errorBody: "Couldn't send that \u2014 please try again in a moment.",
    close: "Close",
  },
};

const uk: Dictionary = {
  common: {
    save: "Зберегти",
    saved: "Збережено",
    cancel: "Скасувати",
    tryAgain: "Спробувати ще раз",
    loading: "Завантаження…",
    somethingWentWrong: "Щось пішло не так.",
    back: "Назад",
    stillWorking: "Ще працюємо \u2014 це може зайняти трохи часу.",
    sessionExpired: "Сесія завершилася. Перезавантажте сторінку, щоб увійти знову.",
    topicLocked: "Ця тема ще не відкрита. Спочатку завершіть попередні теми.",
    offline: "Не вдається зв\u2019язатися із сервером. Перевірте з\u2019єднання й спробуйте ще раз.",
    aiBusy: "Сервіс ШІ зараз має проблеми. Спробуйте за хвилину.",
    aiUnavailable: "Ця функція тимчасово недоступна. Спробуйте пізніше.",
    rateLimited: "Ви дещо поспішаєте. Зачекайте трохи й спробуйте ще раз.",
  },
  sidebar: {
    appName: "unsparing",
    dashboard: "Дашборд",
    learn: "Навчання",
    practice: "Практика",
    knowledgeMap: "Карта знань",
    mistakes: "Помилки",
    progress: "Прогрес",
    projects: "Проєкти",
    interview: "Співбесіда",
    settings: "Налаштування",
    day: "день",
    days: "днів",
    openMenu: "Відкрити меню",
    closeMenu: "Закрити меню",
    language: "Мова",
  },
  landing: {
    signIn: "Увійти",
    startLearning: "Почати навчання",
    eyebrow: "Спочатку практика, а не лекції",
    heroTitle: "Вчіться програмувати з ментором, який не дасть відкараскатися фразою «воно ж працює».",
    heroSubtitle:
      "Ніякого циклу «лекція-тест». Ви розв\u2019язуєте реальні задачі, суворий сеньйор-рев\u2019юер розбирає, що саме не так, а наступна задача стає складнішою лише тоді, коли ви це заслужили.",
    topicsLine: "будь-яка тема — JS, React, SQL, Python, системний дизайн...",
    reviewLabel: "closures-exercise-04 · рев'ю",
    reviewYou1: "Я використав var-лічильник тут, бо так простіше.",
    reviewMentor1:
      "Недостатньо. Простіше в якому сенсі — за часом реалізації, складністю виконання чи читабельністю? Кожна змінна в цьому циклі ділить одне й те саме зв\u2019язування. Що станеться з вашим колбеком, коли цикл завершиться раніше, ніж він виконається?",
    reviewYou2: "...він завжди виведе останнє значення, а не те, яке було на момент створення.",
    reviewMentor2:
      "Правильний діагноз. Тепер виправте це через прив\u2019язку на кожній ітерації — і не просто підставляйте хелпер з бібліотеки, не пояснивши, чому це вирішує проблему.",
    loopHeading: "Кожна тема проходить один і той самий цикл",
    loopStages: [
      "Зрозуміти",
      "Пригадати",
      "Практика",
      "Розв\u2019язати",
      "Пояснити",
      "Рев\u2019ю",
      "Застосувати",
      "Повторити",
    ],
    loopCaption:
      "Завершення теми — це не «ви відкрили урок». Це продемонстрована компетентність, виміряна окремо за знаннями, застосуванням, налагодженням, поясненням і утриманням для кожної теми.",
    notThis1: "не це",
    notThis2: "не це",
    thisLabel: "це",
    notThisText1: "Вікно чат-бота з кращою темою оформлення, що відповідає на будь-що.",
    notThisText2: "Відеокурс, який позначає тему «завершеною» тієї миті, як ви її переглянули.",
    thisText:
      "Система, яка постійно вимірює, що ви насправді вмієте, знаходить, де саме ламається розуміння, і будує наступну задачу на основі цього.",
    footer: "unsparing — освіта з програмування, орієнтована на практику",
  },
  onboarding: {
    setUp: "Налаштуйте свій шлях",
    title: "Кілька запитань перед стартом",
    goalLabel: "Яка ваша мета навчання?",
    goals: {
      first_job: "Отримати першу роботу розробника",
      interview_prep: "Підготуватися до співбесід",
      improve_skills: "Покращити наявні навички",
      learn_new_tech: "Вивчити нову технологію",
      production_skills: "Опанувати продакшн-навички",
      master_topic: "Досконало опанувати конкретну тему",
    },
    levelLabel: "Який ваш поточний рівень?",
    levels: {
      beginner: "Початківець",
      junior: "Джуніор",
      intermediate: "Середній рівень",
      advanced: "Просунутий рівень",
      not_sure: "Не впевнений — перевірте мене",
    },
    levelHints: {
      beginner: "Ви новачок або майже без досвіду. Обирайте це, якщо ніколи не програмували.",
      junior: "Ви вже створювали невеликі речі, але основи ще хитаються.",
      intermediate: "Ви робите справжні функції й хочете заглибитися.",
      advanced: "Ви працюєте з цим щодня й хочете закрити прогалини чи піти далі.",
      not_sure: "Короткий тест визначить рівень. Якщо ви ніколи не програмували, обирайте «Початківець» — тест не для тих, хто щойно починає.",
    },
    topicLabel: "Що ви хочете вивчити?",
    presetTopics: [
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "HTML і CSS",
      "Node.js",
      "SQL",
      "Git",
      "Python",
      "Алгоритми",
      "Структури даних",
      "Системний дизайн",
      "Своя тема…",
    ],
    customTopicPlaceholder: 'напр. "React Server Components"',
    styleLabel: "Стиль навчання",
    styles: {
      more_practice: "Більше практики",
      balanced: "Збалансовано",
      more_theory: "Більше теорії",
    },
    timeLabel: "Доступний час",
    times: {
      "15min": "15 хв / день",
      "30min": "30 хв / день",
      "1hr": "1 година / день",
      "2hr_plus": "2+ години / день",
    },
    startDiagnostic: "Почати діагностику",
    generatePath: "Створити мій навчальний шлях",
    enterTopicError: "Введіть тему, яку хочете вивчити.",
    genericError: "Щось пішло не так.",
    buildingDiagnostic: "Формуємо діагностику, яка справді охоплює тему…",
    scoringAnswers: "Оцінюємо ваші відповіді…",
    generatingPath: "Створюємо ваш навчальний шлях…",
    diagnosticFor: "Діагностика",
    diagnosticTitle: "Подивимось, на якому рівні ви насправді",
    diagnosticSubtitle: (count, subtopics) =>
      `${count} запитань за ${subtopics} підтемами — достатньо, щоб точно визначити рівень, а не вгадати. Відповідайте, як можете; часткові чи невпевнені відповіді теж підходять — це теж корисний сигнал.`,
    questionAnswerPlaceholder: "Ваша відповідь…",
    submitDiagnostic: "Надіслати діагностику",
    couldNotGenerateDiagnostic: "Не вдалося створити діагностику. Спробуйте ще раз.",
    couldNotScoreDiagnostic: "Не вдалося оцінити діагностику. Спробуйте ще раз.",
    couldNotGeneratePath: "Не вдалося створити ваш навчальний шлях. Спробуйте ще раз.",
    personalize: "Налаштувати",
    personalizeHint: "Необов\u2019язково \u2014 типові значення вже вибрано",
    notSure: "Не знаю",
    unansweredWarning: (count) => `Без відповіді: ${count}. Такі запитання буде враховано як незнайомі.`,
    submitAnyway: "Все одно надіслати",
    keepAnswering: "Продовжити відповідати",
    diagnosticSteps: ["Добираємо запитання до теми\u2026", "Поєднуємо запитання про концепції та код\u2026"],
    scoringSteps: ["Порівнюємо ваші відповіді\u2026", "Оцінюємо ваш рівень\u2026"],
    pathSteps: ["Складаємо карту тем\u2026", "Впорядковуємо за передумовами\u2026", "Підлаштовуємо шлях під ваш рівень\u2026"],
  },
  settings: {
    eyebrow: "Налаштування",
    title: "Профіль і налаштування",
    account: "Обліковий запис",
    learningGoal: "Мета навчання",
    learningStyle: "Стиль навчання",
    availableTime: "Доступний час",
    couldNotSave: "Не вдалося зберегти зміну. Попереднє значення збережено.",
    availableTimeHint: "Визначає, скільки вправ у сесії. Діє з наступної сесії.",
    language: "Мова",
    languageNames: { en: "English", uk: "Українська" },
  },
  dashboard: {
    welcomeBack: "З поверненням",
    defaultPathTitle: "Ваш навчальний шлях",
    nextActionCopy: {
      review: "Час для повторення за інтервальним методом",
      continue: "Продовжити з того місця, де зупинились",
      start: "Почати наступну тему",
    },
    continueButton: "Продовжити",
    masterySoFar: (mastery) => `Майстерність поки що: ${mastery}`,
    noActivePath: "Активного навчального шляху ще немає.",
    chooseTopic: "Оберіть тему, щоб почати.",
    overallMastery: "Загальна майстерність",
    topicsMastered: "Опановано тем",
    streak: "Серія",
    xp: "Досвід (XP)",
    statHints: {
      overallMastery: "Наскільки добре ви справді вмієте те, що практикували, у відсотках.",
      topicsMastered: "Теми, які ви засвоїли добре.",
      streak: "Скільки днів поспіль ви займалися.",
      xp: "Бали за правильні відповіді — більше, якщо не потрібні підказки.",
    },
    needsReview: "Потребує повторення",
    viewAll: "Переглянути всі",
    reviewButton: "Почати повторення",
    pathCompleteTitle: "Ви пройшли цей навчальний шлях",
    pathCompleteBody: "Усі теми завершено. Оберіть, що вивчати далі, або продовжуйте вдосконалюватися в практиці.",
    moreReviewsDue: (count) => `Ще тем для повторення: ${count}`,
  },
  learn: {
    eyebrow: "Навчальний шлях",
    noActivePath: "Активного навчального шляху ще немає. Завершіть онбординг, щоб створити його.",
    notStarted: "не розпочато",
    startNewTopic: "Почати нову тему",
    locked: "Заблоковано",
    lockedRequiresLabel: "Потрібно спочатку:",
    upNext: "Далі",
    topicsMastered: (mastered, total) => `Опановано тем: ${mastered} з ${total}`,
    lockedNoticeTitle: "Ця тема заблокована",
    lockedNoticeBody: "Спочатку завершіть попередні теми — тоді вона відкриється.",
    backToPath: "Назад до навчального шляху",
    finishFirstLabel: "Спочатку завершіть:",
    topicsCompleted: (done, total) => `Завершено тем: ${done} з ${total}`,
    strictOrderNote: "Ваш шлях відкривається тема за темою, по порядку. Завершіть кожну, щоб відкрити наступну.",
    lockedNoticeGoTo: (title) => `Перейти до «${title}»`,
    lockedNoticePractice: "Практика відкривається для теми, коли ви дійдете до неї в навчальному шляху.",
  },
  newPath: {
    eyebrow: "Новий навчальний шлях",
    title: "Що хочете вивчати далі?",
    subtitle: "Це створить окрему навчальну програму поряд із тим, що ви вже вивчаєте \u2014 прогрес з інших тем залишиться незмінним.",
    suggestedNext: "Пропонований наступний крок",
    orPickAny: "Або оберіть будь-яку тему",
    alreadyTried: "(вже розпочато)",
    startButton: "Створити навчальний шлях",
  },
  practice: {
    eyebrow: "Практика",
    title: "Практичні задачі",
    subtitle:
      "Дошка окремих задач, згенерованих на основі того, що ви зараз вивчаєте — оберіть складність і починайте, без налаштувань.",
    topicFilterLabel: "Тема",
    allTopics: "Усі теми",
    difficultyFilterLabel: "Складність",
    allDifficulties: "Усі",
    difficultyLabels: { easy: "Легка", medium: "Середня", hard: "Складна" },
    statusLabels: { solved: "Розв'язано", attempted: "Спроба була", unsolved: "Не розв'язано" },
    solveButton: "Розв'язати",
    generateMore: "Згенерувати ще задач",
    generating: "Генеруємо задачі…",
    noProblems: "Задач поки немає — генеруємо перший набір на основі того, що ви вивчаєте.",
    noProblemsForFilter: "Під цей фільтр задач поки немає. Спробуйте іншу тему чи складність.",
    problemsCount: (n) => `${n} задач${n === 1 ? "а" : n >= 2 && n <= 4 ? "і" : ""}`,
    addTopicLabel: "Додати тему на дошку",
    addTopicPlaceholder: 'напр. "List comprehensions у Python"',
    addTopicButton: "Додати",
    couldNotGenerate: "Не вдалося згенерувати задачі для цієї теми. Спробуйте ще раз.",
    couldNotLoadTopics: "Не вдалося завантажити ваші теми.",
    noActivePath: "Завершіть онбординг, щоб створити навчальний шлях — тоді тут з\u2019являться задачі.",
    backToBoard: "До дошки задач",
    topicNotReached: "Ця тема — частина вашого навчального шляху, і ви ще не дійшли до неї. Спочатку вивчіть її по порядку.",
    hiddenLocked: (count) => `Задач, прихованих до відкриття їхніх тем: ${count}`,
  },
  session: {
    sessionLabel: "Сесія",
    practiceLabel: "Практика",
    todaysObjective: "Сьогоднішня мета",
    drilling: "Тренування",
    learnObjective: (topic) => `Зрозуміти тему «${topic}» і правильно застосувати її в реальному коді.`,
    practiceObjective: (topic) => `Вправи з кодування на тему «${topic}» — без теорії, одразу до практики.`,
    currentMastery: (mastery) => `Поточна майстерність: ${mastery}% — складність підбирається автоматично.`,
    startSession: "Почати сесію",
    startPracticing: "Почати тренування",
    preparingConcept: "Готуємо короткий огляд концепції…",
    reviewingAnswer: "Перевіряємо вашу відповідь…",
    preparingExercise: "Готуємо наступну вправу…",
    startPracticingButton: "Почати тренування",
    preparingLesson: "Готуємо ваш урок…",
    theoryDepthLabel: "Теорія перед початком",
    depthFull: "Повний урок",
    depthFullHint: "Крок за кроком, без вимог до підготовки",
    depthQuick: "Короткий повтор",
    depthQuickHint: "Один короткий огляд",
    hideTheory: "Сховати теорію",
    showTheory: "Показати теорію",
    reviseAndResubmit: "Виправити й надіслати знову",
    nextExercise: "Наступна вправа",
    harderVariation: "Складніший варіант",
    sessionComplete: "Сесію завершено",
    exercisesReviewed: (count, topic) => `Розглянуто ${count} вправ з теми «${topic}».`,
    anotherRound: "Ще один раунд",
    backToDashboard: "До дашборду",
    backToPractice: "До практики",
    explainReasoningPlaceholder: "Поясніть свою логіку — що робить цей код і чому?",
    writeAnswerPlaceholder: "Напишіть вашу відповідь…",
    submitAnswer: "Надіслати відповідь",
    hint: (used, total) => `Підказка (${used}/${total})`,
    hintLabel: (n) => `Підказка ${n}`,
    noMoreHints: "Підказок більше немає",
    markSolutionRevealed: "Я підглянув(-ла) відповідь (менше XP)",
    stuckNote: "Застрягли? Надішліть свою найкращу спробу — після фідбеку можна побачити розібраний розв'язок.",
    showSolution: "Показати розв'язок",
    solutionTitle: "Розібраний розв'язок",
    solutionNote: "Прочитайте, потім закрийте й напишіть самі. Відповіді звідси дають менше XP.",
    couldNotLoadSolution: "Не вдалося завантажити розв'язок. Спробуйте ще раз.",
    solutionMarked: "Враховано \u2014 за цю спробу буде менше XP.",
    couldNotGenerateExercise: "Не вдалося створити вправу. Спробуйте ще раз.",
    couldNotStartSession: "Не вдалося розпочати сесію. Спробуйте ще раз.",
    couldNotEvaluate: "Не вдалося оцінити вашу відповідь. Спробуйте ще раз.",
    challenge: "виклик",
    sizedFor: (count, time) => `Вправ: ${count} — підібрано під ваш час (${time})`,
    conceptSteps: ["Добираємо ключові ідеї\u2026", "Пишемо приклади\u2026"],
    exerciseSteps: ["Підлаштовуємо складність під ваш рівень\u2026", "Пишемо вправу\u2026"],
    reviewSteps: ["Перевіряємо правильність і крайні випадки\u2026", "Пишемо відгук\u2026"],
    summaryCorrect: (correct, total) => `${correct} з ${total} правильно`,
    summaryAnswers: "Ваші відповіді",
    summaryReview: "Варто повторити",
    summaryNotYet:
      "Тема ще не зарахована — приблизно половина відповідей має бути правильною. Ще один раунд зарахується, а урок можна перечитати.",
    summaryViewMistakes: "Усі помилки",
    resumeTitle: "Незавершена сесія",
    resumeDescription: (done, total) => `Ви виконали ${done} з ${total} вправ \u2014 продовжте з того місця, де зупинилися.`,
    resume: "Продовжити",
    startOver: "Почати заново",
    couldNotGetHint: "Не вдалося отримати підказку. Спробуйте ще раз.",
  },
  exercise: {
    typeLabels: {
      multiple_choice: "Вибір відповіді",
      code_prediction: "Передбачити результат",
      code_completion: "Доповнення коду",
      debugging: "Налагодження",
      refactoring: "Рефакторинг",
      implementation: "Реалізація",
      architecture_decision: "Архітектурне рішення",
      explain_code: "Пояснити код",
      find_the_bug: "Знайти помилку",
      compare_implementations: "Порівняти реалізації",
      optimize_code: "Оптимізувати код",
      write_tests: "Написати тести",
      review_code: "Рев'ю коду",
    },
    difficultyLabels: {
      easy: "Легка",
      medium: "Середня",
      hard: "Складна",
      interview: "Співбесіда",
      real_world: "Реальний проєкт",
    },
    hintLevelLabels: {
      direction: "напрямок",
      specific_problem: "конкретна проблема",
      strong_hint: "суттєва підказка",
    },
  },
  concept: {
    quickConcept: "Коротка концепція",
    lesson: "Урок",
    keyTakeaways: "Головне",
    stepOf: (step, total) => `Крок ${step} з ${total}`,
    back: "Назад",
    next: "Далі",
    quickCheck: "Швидка перевірка",
    checkCorrect: "Правильно.",
    checkIncorrect: "Не зовсім.",
    tryIt: "Спробуйте самі",
    reportProblem: "Щось незрозуміло чи неправильно?",
    reportPlaceholder: "Що було незрозумілим або хибним?",
    reportSend: "Надіслати",
    reportSent: "Дякуємо — це допоможе виправити урок.",
    reportError: "Не вдалося надіслати. Спробуйте ще раз.",
    tryItPreview: "Попередній перегляд",
  },
  feedback: {
    resultLabels: {
      correct: "Правильно",
      partially_correct: "Частково правильно",
      incorrect: "Неправильно",
    },
    whatYouDid: "Що ви зробили",
    problem: "Проблема",
    whyItMatters: "Чому це важливо",
    hint: "Підказка",
    nextStep: "Наступний крок",
    conceptualGapDetected: "Виявлено концептуальну прогалину",
    revisitLesson: (heading) => `Перечитати урок: ${heading}`,
    mentorFollowUp: "Уточнення від ментора",
    followUpPlaceholder: "Дайте відповідь на запитання ментора…",
    respondButton: "Відповісти",
    responding: "Надсилаємо…",
    couldNotGetReaction: "Не вдалося отримати реакцію. Спробуйте ще раз.",
    yourReply: "Ваша відповідь",
    mentorReaction: "Ментор",
    rewardXp: (xp) => `+${xp} XP`,
    rewardMastery: (from, to) => `Опанування теми ${from}% \u2192 ${to}%`,
    rewardAchievement: "Досягнення розблоковано",
    scoreBreakdown: "Розбір оцінки",
    showScores: "Показати детальні оцінки",
    hideScores: "Сховати детальні оцінки",
    scoreLabels: {
      correctness: "Правильність",
      logic: "Логіка",
      codeQuality: "Якість коду",
      bestPractices: "Найкращі практики",
      edgeCaseHandling: "Обробка граничних випадків",
    },
  },
  knowledgeMap: {
    eyebrow: "Карта знань",
    noActivePath: "Активного навчального шляху ще немає.",
    notAttempted: "Ще не спробовано.",
    reviewDue: "Час повторити",
    weakestAxis: (axis, value) => `Найслабше: ${axis} (${value}%)`,
    axes: {
      knowledge: "Знання",
      application: "Застосування",
      debugging: "Налагодження",
      explanation: "Пояснення",
      retention: "Утримання",
    },
  },
  mistakes: {
    eyebrow: "База помилок",
    title: "Повторювані прогалини",
    subtitle:
      "Помилка, що трапляється тричі й більше, перестає бути випадковістю — вона позначається як концептуальна прогалина і пріоритезується у ваших наступних сесіях.",
    none: "Повторюваних помилок поки немає — нічого повторювати.",
    unknownTopic: "Невідома тема",
    conceptualGap: "— концептуальна прогалина",
    firstSeen: (date) => `Вперше помічено ${date}`,
    lastSeen: (date) => `востаннє ${date}`,
    cleanStreak: (count, threshold) => `${count}/${threshold} чистих спроб з моменту останньої появи`,
    markResolved: "Позначити вирішеною",
    practiceThis: "Потренуватися",
    resolving: "Вирішується…",
    recentlyResolved: "Нещодавно вирішені",
    resolvedOn: (date) => `Вирішено ${date}`,
  },
  progress: {
    eyebrow: "Прогрес",
    title: (name) => `Прогрес користувача ${name}`,
    overallMastery: "Загальна майстерність",
    currentStreak: "Поточна серія",
    longestStreak: "Найдовша серія",
    totalXp: "Всього XP",
    recentSessions: "Останні сесії",
    noSessions: "Сесій поки немає.",
    activityTitle: "Активність за останні 12 тижнів",
    activitySummary: (total, activeDays) => `Відповідей: ${total}, активних днів: ${activeDays}`,
    activityCell: (date, count) => `${date}: відповідей — ${count}`,
    activityLess: "Менше",
    activityMore: "Більше",
    sessionCompleted: "завершено",
    sessionInProgress: "триває",
  },
  achievements: {
    sectionTitle: "Досягнення",
    none: "Значків поки немає — продовжуйте практикуватися, щоб отримати перший.",
    earnedOn: (date) => `Отримано ${date}`,
    catalog: {
      first_win: { title: "Перша перемога", description: "Правильно виконали першу вправу." },
      perfect_five: {
        title: "П\u2019ять поспіль",
        description: "П\u2019ять правильних відповідей поспіль без підказок і без розкриття рішення.",
      },
      streak_7: { title: "Тижнева серія", description: "Практикувалися 7 днів поспіль." },
      streak_30: { title: "Місячна серія", description: "Практикувалися 30 днів поспіль." },
      first_mastery: { title: "Опанували тему", description: "Вперше досягли рівня майстерності з теми." },
      mistake_slayer: { title: "Переможець помилок", description: "Вирішили 5 повторюваних помилок." },
      project_shipped: { title: "Здано!", description: "Виконали всі завдання проєкту." },
      xp_500: { title: "500 XP", description: "Набрали 500 XP загалом." },
      xp_2000: { title: "2 000 XP", description: "Набрали 2 000 XP загалом." },
    },
  },
  projects: {
    eyebrow: "Проєкти",
    backToProjects: "Назад до проєктів",
    title: "Реальні проєкти",
    subtitle:
      "Сплановані як справжні тікети, перевіряються як справжній пул-реквест — ментор у ролі вашого тімліда розбиває роботу на задачі й перевіряє кожне рішення за конкретними вимогами.",
    noProjects: "Проєктів поки немає — почніть новий вище.",
    tasksCount: (done, total) => `${done} / ${total} завдань`,
    continueTask: (code) => `Продовжити з ${code}`,
    allTasksDone: "Усі завдання схвалено",
    statusLabels: {
      not_started: "не розпочато",
      in_progress: "в процесі",
      completed: "завершено",
    },
    newProject: {
      startButton: "Почати новий проєкт",
      topicLabel: "Тема",
      topicPlaceholder: 'напр. "React" або "REST API на Node.js"',
      levelLabel: "Рівень",
      generate: "Створити проєкт",
      scopingTasks: "Плануємо завдання…",
      buildingSteps: ["Розбиваємо на завдання…", "Пишемо вимоги…", "Готуємо стартові файли…"],
      cancel: "Скасувати",
      enterTopicError: "Введіть тему для проєкту.",
      genericError: "Не вдалося створити проєкт. Спробуйте ще раз.",
      ideasHeading: "Оберіть ідею проєкту",
      ideasSubtitle: "Кілька варіантів на основі того, що ви зараз вивчаєте.",
      loadingIdeas: "Придумуємо ідеї\u2026",
      ideasError: "Не вдалося завантажити пропозиції \u2014 ви все ще можете описати свою ідею нижче.",
      refreshIdeas: "Інші ідеї",
      buildThis: "Створити це",
      useOwnIdea: "Або опишіть свою ідею",
      backToIdeas: "Назад до пропозицій",
    },
    taskStatus: {
      todo: "До виконання",
      in_review: "На перевірці",
      changes_requested: "Потрібні правки",
      done: "Готово",
    },
  },
  taskRunner: {
    backToProject: "Назад до проєкту",
    nextTask: (code, title) => `Наступне завдання: ${code} \u00b7 ${title}`,
    requirements: "Вимоги",
    approved: "Затверджено — це завдання виконано.",
    submitForReview: "Надіслати на перевірку",
    resubmit: "Надіслати повторно",
    reviewing: "Перевіряємо…",
    genericError: "Щось пішло не так.",
    couldNotReview: "Не вдалося отримати рецензію. Спробуйте ще раз.",
    earlierSubmissions: (count) => `Попередніх спроб: ${count}`,
  },
  reviewPanel: {
    approved: "Затверджено",
    changesRequested: "Потрібні правки",
    severity: {
      blocking: "Блокує",
      suggestion: "Пропозиція",
      nit: "Дрібниця",
    },
  },
  multiFileEditor: {
    preview: "Перегляд",
  },
  codeEditor: {
    reset: "Скинути",
    run: "Запустити",
    running: "Виконується…",
    format: "Форматувати",
    formatting: "Форматуємо…",
    error: "Помилка",
    noConsoleOutput: "(немає виводу в консолі)",
    timedOut: "Час вийшов через 3с (можливо, нескінченний цикл).",
    preview: "Попередній перегляд",
    runTests: "Запустити тести",
    runningTests: "Тести виконуються…",
    testsSummary: (passed, total) => `Проходять ${passed} з ${total} тестів`,
    testGot: (actual) => `отримано ${actual}`,
    testExpected: (expected) => `очікувалось ${expected}`,
    testsUnavailable: "У цьому браузері тести не запускаються.",
  },
  interview: {
    title: "Практика співбесід — незабаром",
    body1:
      "Пробні співбесіди: ментор ставить запитання, оскаржує вашу відповідь, уточнює, а потім оцінює всю розмову. Поки що це недоступно.",
  },
  feedbackForm: {
    buttonLabel: "Зворотний зв'язок",
    dialogTitle: "Надіслати відгук",
    dialogDescription: "Йде напряму на пошту команди — опишіть якомога детальніше.",
    categoryLabel: "Тип",
    categoryBug: "Помилка",
    categoryIdea: "Ідея",
    categoryOther: "Інше",
    messageLabel: "Повідомлення",
    messagePlaceholder: "Що сталося або що могло б допомогти?",
    submit: "Надіслати відгук",
    submitting: "Надсилання…",
    sentTitle: "Дякуємо — надіслано!",
    sentBody: "Ваш відгук надіслано на пошту команди.",
    errorBody: "Не вдалося надіслати — спробуйте ще раз за хвилину.",
    close: "Закрити",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, uk };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

/**
 * The learner-facing name of a skill level ("junior" -> "Junior" / "Джуніор").
 * Levels are stored as bare keys, and rendering the key directly showed
 * English to everyone; unknown values (e.g. legacy data) fall back to the raw string.
 */
export function levelLabel(t: Dictionary, level: string): string {
  return (t.onboarding.levels as Record<string, string>)[level] ?? level;
}
