/**
 * @module models
 *
 * Barrel file re-exporting all model typedefs and functions
 * for use by other agents.
 */

export {
  DEFAULT_POINT_CONFIG,
  calculateActivityPoints,
  getTotalPoints,
  getMonthPoints,
  getCampaignPoints,
} from './points.js';

export { createUser, addPointsToUser } from './user.js';

export { createTeam, calculateTeamPoints, calculateTeamMonthPoints } from './team.js';

export { createActivity, generateActivityId } from './activity.js';

export {
  createCampaign,
  isCampaignActive,
  getCampaignParticipantIds,
  getCampaignLeaderboard,
  getCampaignTeamLeaderboard,
} from './campaign.js';
