/**
 * @module views/config
 *
 * Point configuration UI: load, save, reset, export.
 */

import {
  getConfig, updateConfig, log, autoSave, downloadJSON,
  calculateCoursePoints, calculateQuizBonus,
  calculateHackathonPoints, calculateMeetingPoints,
} from './shared.js';

export function updatePointConfig() {
  const cfg = getConfig();
  const pc = cfg.pointConfig;
  pc.awsCourseTypes['AWS Builder Lab'] = parseInt(document.getElementById('awsBuilderLab').value);
  pc.awsCourseTypes['AWS Cloud Quest'] = parseInt(document.getElementById('awsCloudQuest').value);
  pc.awsCourseTypes['AWS Jam Journey'] = parseInt(document.getElementById('awsJamJourney').value);
  pc.awsCourseTypes['AWS Simulearn'] = parseInt(document.getElementById('awsSimulearn').value);
  pc.awsCourseTypes['Certification Exam Preparation'] = parseInt(document.getElementById('certExamPrep').value);
  pc.awsCourseTypes['Digital Course With Lab'] = parseInt(document.getElementById('digitalCourseWithLab').value);
  pc.generalCourses['Classroom Training'] = parseInt(document.getElementById('classroomTraining').value);
  pc.generalCourses['Digital Courses - Foundational'] = parseInt(document.getElementById('digitalFoundational').value);
  pc.generalCourses['Digital Courses - Associate'] = parseInt(document.getElementById('digitalAssociate').value);
  pc.generalCourses['Digital Courses - Professional'] = parseInt(document.getElementById('digitalProfessional').value);
  pc.generalCourses['Digital Courses - Specialty'] = parseInt(document.getElementById('digitalSpecialty').value);
  pc.events['Live Events'] = parseInt(document.getElementById('liveEvents').value);
  pc.hackathons['Hackathons - Participation'] = parseInt(document.getElementById('hackathonParticipation').value);
  pc.hackathons['Hackathons - 3rd Place'] = parseInt(document.getElementById('hackathon3rd').value);
  pc.hackathons['Hackathons - 2nd Place'] = parseInt(document.getElementById('hackathon2nd').value);
  pc.hackathons['Hackathons - 1st Place'] = parseInt(document.getElementById('hackathon1st').value);
  pc.quizzes['Quiz Completion'] = parseInt(document.getElementById('quizCompletion').value);
  pc.quizzes['Quiz 80%+ Score'] = parseInt(document.getElementById('quiz80Plus').value);
  pc.quizzes['Quiz Perfect Score'] = parseInt(document.getElementById('quizPerfect').value);
  updateConfig({ ...cfg, pointConfig: pc });
  log('Point configuration updated');
}

export function loadConfiguration() {
  const pc = getConfig().pointConfig;
  document.getElementById('awsBuilderLab').value = pc.awsCourseTypes['AWS Builder Lab'];
  document.getElementById('awsCloudQuest').value = pc.awsCourseTypes['AWS Cloud Quest'];
  document.getElementById('awsJamJourney').value = pc.awsCourseTypes['AWS Jam Journey'];
  document.getElementById('awsSimulearn').value = pc.awsCourseTypes['AWS Simulearn'];
  document.getElementById('certExamPrep').value = pc.awsCourseTypes['Certification Exam Preparation'];
  document.getElementById('digitalCourseWithLab').value = pc.awsCourseTypes['Digital Course With Lab'];
  document.getElementById('classroomTraining').value = pc.generalCourses['Classroom Training'];
  document.getElementById('digitalFoundational').value = pc.generalCourses['Digital Courses - Foundational'];
  document.getElementById('digitalAssociate').value = pc.generalCourses['Digital Courses - Associate'];
  document.getElementById('digitalProfessional').value = pc.generalCourses['Digital Courses - Professional'];
  document.getElementById('digitalSpecialty').value = pc.generalCourses['Digital Courses - Specialty'];
  document.getElementById('liveEvents').value = pc.events['Live Events'];
  document.getElementById('hackathonParticipation').value = pc.hackathons['Hackathons - Participation'];
  document.getElementById('hackathon3rd').value = pc.hackathons['Hackathons - 3rd Place'];
  document.getElementById('hackathon2nd').value = pc.hackathons['Hackathons - 2nd Place'];
  document.getElementById('hackathon1st').value = pc.hackathons['Hackathons - 1st Place'];
  document.getElementById('quizCompletion').value = pc.quizzes['Quiz Completion'];
  document.getElementById('quiz80Plus').value = pc.quizzes['Quiz 80%+ Score'];
  document.getElementById('quizPerfect').value = pc.quizzes['Quiz Perfect Score'];
}

export function resetToDefaults() {
  document.getElementById('awsBuilderLab').value = 100; document.getElementById('awsCloudQuest').value = 75;
  document.getElementById('awsJamJourney').value = 150; document.getElementById('awsSimulearn').value = 75;
  document.getElementById('certExamPrep').value = 100; document.getElementById('digitalCourseWithLab').value = 100;
  document.getElementById('classroomTraining').value = 100; document.getElementById('digitalFoundational').value = 50;
  document.getElementById('digitalAssociate').value = 75; document.getElementById('digitalProfessional').value = 100;
  document.getElementById('digitalSpecialty').value = 100; document.getElementById('liveEvents').value = 25;
  document.getElementById('hackathonParticipation').value = 150; document.getElementById('hackathon3rd').value = 250;
  document.getElementById('hackathon2nd').value = 350; document.getElementById('hackathon1st').value = 450;
  document.getElementById('quizCompletion').value = 20; document.getElementById('quiz80Plus').value = 50;
  document.getElementById('quizPerfect').value = 70;
  updatePointConfig();
  log('Configuration reset to defaults');
}

export function saveConfiguration() {
  updatePointConfig();
  const status = document.getElementById('configStatus');
  status.textContent = 'Configuration saved!';
  setTimeout(() => { status.textContent = ''; }, 3000);
}

export function exportConfig() { downloadJSON(getConfig(), 'cloud_comp_config.json'); }

export function calculatePoints(courseLevel, courseType, activityType = 'course', score = null, placement = null) {
  const pc = getConfig().pointConfig;
  if (activityType === 'live_event') return calculateMeetingPoints(pc);
  if (activityType === 'hackathon') return calculateHackathonPoints(placement, pc);
  if (activityType === 'quiz') return calculateQuizBonus(score, pc);
  return calculateCoursePoints(courseType, courseLevel, pc);
}
