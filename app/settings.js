'use strict';

(() => {

  const defaultUpdateIntervalSec = 600;
  const baseTimeDaysAgo = 14;

  class Setting {
    constructor(startupTime) {
      this._startupTime = startupTime;
    }

    initEventListener() {

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          remote.getCurrentWindow().close();
        }
      });

      document.getElementById('save-settings-button').addEventListener('click', () => {
        this.updateSettings()
          .updateLastExecutionTimeWithBaseTime();
        remote.getCurrentWindow().getParentWindow().webContents.send('save-settings');
        remote.getCurrentWindow().close();
      });

      document.getElementById('cancel-settings-button').addEventListener('click', () => {
        remote.getCurrentWindow().close();
      });

      return this;
    }

    displayDefaultSettings() {
      document.getElementById('default-update-interval').innerHTML = defaultUpdateIntervalSec;

      return this;
    }

    displaySettings() {
      document.getElementById('url').value = localStorage.getItem('url');
      document.getElementById('api-key').value = localStorage.getItem('apiKey');
      document.getElementById('project-id').value = localStorage.getItem('projectId');
      document.getElementById('update-interval').value = localStorage.getItem('updateInterval');

      const baseTimeValue = localStorage.getItem('baseTimeValue');
      if (baseTimeValue !== null) {
        document.getElementById('base-time').value = baseTimeValue;
      }

      return this;
    }

    updateSettings() {
      localStorage.setItem('url', document.getElementById('url').value);
      localStorage.setItem('apiKey', document.getElementById('api-key').value);
      localStorage.setItem('projectId', document.getElementById('project-id').value);
      localStorage.setItem('updateInterval', document.getElementById('update-interval').value);

      return this;
    }

  }

  document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = JSON.parse(localStorage.getItem('isDarkMode'));
    document.body.classList.toggle('dark', isDarkMode);
	
	const appStartupTime = new Date();

    const setting = new Setting(appStartupTime);
    setting.initEventListener()
      .displayDefaultSettings()
      .displaySettings();
  });
})();

