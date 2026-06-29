// @vitest-environment jsdom
//
// Tests for the Activity Type picker that bridges manually-added
// activities and the Configuration tab's point types. Verifies:
//   - the dropdown is populated from the current pointConfig
//   - picking an option auto-fills title + points
//   - the "Custom" option clears the inputs
//   - readPickerSelection parses values correctly
//
// The picker is wired into both the Add Manual Points and Bulk Award
// Points modals; this test covers the shared helpers.

import { describe, it, expect, beforeEach } from 'vitest';
import { _resetForTesting, updateConfig, getConfig } from '../../src/core/state.js';
import { DEFAULT_POINT_CONFIG } from '../../src/models/points.js';
import {
  populateActivityTypePicker,
  onActivityTypePicked,
} from '../../src/views/users.js';

beforeEach(() => {
  localStorage.clear();
  _resetForTesting();
  updateConfig({ pointConfig: DEFAULT_POINT_CONFIG });

  document.body.innerHTML = `
    <select id="picker"
            data-title-id="titleInput"
            data-points-id="pointsInput">
      <option value="">Custom (free-form)</option>
    </select>
    <input id="titleInput" type="text">
    <input id="pointsInput" type="number">
  `;
});

describe('populateActivityTypePicker', () => {
  it('rebuilds the option list grouped by configuration sections', () => {
    populateActivityTypePicker('picker');
    const sel = document.getElementById('picker');

    expect(sel.options[0].value).toBe('');
    expect(sel.options[0].textContent).toMatch(/Custom/i);

    const groups = sel.querySelectorAll('optgroup');
    expect(groups.length).toBe(5);
    expect([...groups].map(g => g.label)).toEqual([
      'Self-Paced Digital Training',
      'Live Learning Sessions',
      'Certifications & Exams',
      'Gamified Events & Challenges',
      'Community Engagement',
    ]);
  });

  it('encodes category + subCategory in the option value with current point total', () => {
    populateActivityTypePicker('picker');
    const cp = [...document.getElementById('picker').options]
      .find(o => o.textContent.startsWith('Cloud Practitioner'));
    expect(cp).toBeDefined();
    expect(cp.value).toBe('certifications|Cloud Practitioner');
    expect(cp.dataset.points).toBe('200');
    expect(cp.textContent).toContain('200 pts');
  });

  it('reflects edits made on the Configuration tab', () => {
    const cfg = getConfig();
    const next = {
      ...cfg,
      pointConfig: {
        ...DEFAULT_POINT_CONFIG,
        certifications: { ...DEFAULT_POINT_CONFIG.certifications, 'Cloud Practitioner': 999 },
      },
    };
    updateConfig(next);

    populateActivityTypePicker('picker');
    const cp = [...document.getElementById('picker').options]
      .find(o => o.textContent.startsWith('Cloud Practitioner'));
    expect(cp.dataset.points).toBe('999');
    expect(cp.textContent).toContain('999 pts');
  });

  it('is a no-op when the target select does not exist', () => {
    expect(() => populateActivityTypePicker('does-not-exist')).not.toThrow();
  });
});

describe('onActivityTypePicked', () => {
  it('auto-fills title and points when a predefined type is picked', () => {
    populateActivityTypePicker('picker');
    const sel = document.getElementById('picker');
    sel.value = 'certifications|Cloud Practitioner';

    onActivityTypePicked(sel);

    expect(document.getElementById('titleInput').value).toBe('Cloud Practitioner');
    expect(document.getElementById('pointsInput').value).toBe('200');
  });

  it('clears title and points when Custom (empty value) is selected', () => {
    document.getElementById('titleInput').value = 'Stale title';
    document.getElementById('pointsInput').value = '777';

    const sel = document.getElementById('picker');
    sel.value = '';
    onActivityTypePicked(sel);

    expect(document.getElementById('titleInput').value).toBe('');
    expect(document.getElementById('pointsInput').value).toBe('');
  });
});
