import { describe, it, expect } from 'vitest';
import * as models from '../../src/models/index.js';

describe('models barrel (index.js)', () => {
  // points.js
  it('re-exports DEFAULT_POINT_CONFIG', () => {
    expect(models.DEFAULT_POINT_CONFIG).toBeDefined();
    expect(typeof models.DEFAULT_POINT_CONFIG).toBe('object');
  });

  it('re-exports calculateCoursePoints', () => {
    expect(typeof models.calculateCoursePoints).toBe('function');
  });

  it('re-exports calculateQuizBonus', () => {
    expect(typeof models.calculateQuizBonus).toBe('function');
  });

  it('re-exports calculateHackathonPoints', () => {
    expect(typeof models.calculateHackathonPoints).toBe('function');
  });

  it('re-exports calculateMeetingPoints', () => {
    expect(typeof models.calculateMeetingPoints).toBe('function');
  });

  it('re-exports getTotalPoints', () => {
    expect(typeof models.getTotalPoints).toBe('function');
  });

  it('re-exports getMonthPoints', () => {
    expect(typeof models.getMonthPoints).toBe('function');
  });

  it('re-exports getCampaignPoints', () => {
    expect(typeof models.getCampaignPoints).toBe('function');
  });

  // user.js
  it('re-exports createUser', () => {
    expect(typeof models.createUser).toBe('function');
  });

  it('re-exports addPointsToUser', () => {
    expect(typeof models.addPointsToUser).toBe('function');
  });

  // team.js
  it('re-exports createTeam', () => {
    expect(typeof models.createTeam).toBe('function');
  });

  it('re-exports calculateTeamPoints', () => {
    expect(typeof models.calculateTeamPoints).toBe('function');
  });

  it('re-exports calculateTeamMonthPoints', () => {
    expect(typeof models.calculateTeamMonthPoints).toBe('function');
  });

  // activity.js
  it('re-exports createActivity', () => {
    expect(typeof models.createActivity).toBe('function');
  });

  it('re-exports generateActivityId', () => {
    expect(typeof models.generateActivityId).toBe('function');
  });

  // campaign.js
  it('re-exports createCampaign', () => {
    expect(typeof models.createCampaign).toBe('function');
  });

  it('re-exports isCampaignActive', () => {
    expect(typeof models.isCampaignActive).toBe('function');
  });

  it('re-exports getCampaignParticipantIds', () => {
    expect(typeof models.getCampaignParticipantIds).toBe('function');
  });

  it('re-exports getCampaignLeaderboard', () => {
    expect(typeof models.getCampaignLeaderboard).toBe('function');
  });

  it('re-exports getCampaignTeamLeaderboard', () => {
    expect(typeof models.getCampaignTeamLeaderboard).toBe('function');
  });

  // Completeness
  it('exports exactly 20 members (8 points + 2 user + 3 team + 2 activity + 5 campaign)', () => {
    expect(Object.keys(models)).toHaveLength(20);
  });
});
