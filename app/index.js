'use strict';

(() => {
  
  const defaultUpdateIntervalSec = 600;
  const isMac = false;
  
  let isDarkMode = JSON.parse(localStorage.getItem('isDarkMode'));

  class RedmineNow {
    constructor() {
      this._settingsWindow = null;
      this._settings = {};
      this._startupTime = null;
      this._needsUpdateStatus = true;
      this._issueStatuses = [];
      this._timer = null;
      this._issues = [];
    }

    initMenu() {
      return this;
    }

    initEventListener() {
      this.toggleDarkMode();

      document.getElementById('open-settings-button').addEventListener('click', () => {
        this.openSettingsWindow();
      });

      return this;
    }

    toggleDarkMode() {
      isDarkMode = document.body.classList.toggle('dark');
      localStorage.setItem('isDarkMode', isDarkMode);

      if (this._settingsWindow !== null) {
        this._settingsWindow.webContents.send('toggle-dark-mode', isDarkMode);
      }
    }

    initStartupTime() {
      this._startupTime = new Date();
      return this;
    }

    fetchIssueStatus() {
      if (!this._needsUpdateStatus) {
        return this;
      }

      if (!this.validateSettings()) {
        return this;
      }

      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.handleResponseFetchIssueStatus(xhr.status, xhr.responseText);
        }
      };

      this.updateLastExecutionTimeWithBaseTime();

      xhr.open('GET', `${this._settings.url}/issue_statuses.json`);
      xhr.setRequestHeader('X-Redmine-API-Key', this._settings.apiKey);
      xhr.send();

      return this;
    }

    handleResponseFetchIssueStatus(status, responseText) {
      if (status === 200) {
        const headers = document.getElementById('headers');
        const container = document.getElementById('container');
        this._issueStatuses = JSON.parse(responseText).issue_statuses;
		
		// get only opened statuses
		var i = this._issueStatuses.length
		while (i--) {
			if (this._issueStatuses[i].is_closed) {
				this._issueStatuses.splice(i, 1);
			} 
		}

        const collapsedHeaders = headers.getElementsByClassName('collapsed');
        const collapsedIds = [];
        for (const header of collapsedHeaders) {
          const headerId = header.getAttribute('id');
          collapsedIds.push(headerId.replace(/header-column-status-/g, ''));
        }

        this.clear();

        this._issueStatuses.forEach(issueStatus => {
          const header = document.createElement('div');
          header.id = `header-column-status-${issueStatus.id}`;
          header.className = 'header-column';
          if (collapsedIds.includes(String(issueStatus.id))) {
            header.classList.add('collapsed');
          }
          header.innerText = issueStatus.name;
          header.title = issueStatus.name;
          header.addEventListener('click', () => {
            header.classList.toggle('collapsed');

            const columnId = `column-status-${issueStatus.id}`;
            const column = document.getElementById(columnId);
            column.classList.toggle('collapsed');
          });
          headers.appendChild(header);

          const column = document.createElement('div');
          column.id = `column-status-${issueStatus.id}`;
          column.className = isMac ? 'column' : 'column windows';
          if (collapsedIds.includes(String(issueStatus.id))) {
            column.classList.add('collapsed');
          }
          container.appendChild(column);
        });

        this._needsUpdateStatus = false;
      }

      return this;
    }

    clear() {
      this._issues = [];
      document.getElementById('headers').innerHTML = '';
      document.getElementById('container').innerHTML = '';
    }

    initFetch() {
      const timer = () => {
        this.fetch(1);
        clearInterval(this._timer);
        this._timer = setInterval(timer, this.getUpdateIntervalMsec());
      };

      clearInterval(this._timer);
      this._timer = setInterval(timer, this.getUpdateIntervalMsec());

      return this;
    }

    getUpdateIntervalMsec() {
      return 1000 * (this._settings.updateInterval || defaultUpdateIntervalSec);
    }

    fetch(page) {
      this.fetchIssueStatus();

      if (!this.validateSettings()) {
        return this;
      }

      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.handleResponseFetch(xhr.status, xhr.responseText, page);
        }
      };

      xhr.open('GET', `${this._settings.url}/issues.json${this.getRequestParams(page)}`);
      xhr.setRequestHeader('X-Redmine-API-Key', this._settings.apiKey);
      xhr.send();

      return this;
    }

    handleResponseFetch(status, responseText, page) {
      if (status === 200) {
        const response = JSON.parse(responseText);

        this.keepIssues(response.issues);

        if (this.calcRemainingRequestCount(response, page) > 0) {
          this.fetch(page + 1);
        } else {
          this.sortIssuesByUpdatedOn()
            .showIssues()
            .showTotalIssue()
            .updateLastExecutionTime();
        }
      }

      return this;
    }

    getRequestParams(page) {
      const lastExecutionTime = localStorage.getItem('lastExecutionTime');
      const params = [
        `updated_on=%3C%3D${lastExecutionTime}`,
        'status_id=open',
        'sort=updated_on:asc',
        'limit=100',
        `page=${page}`
      ];

      const projectId = this._settings.projectId;
      if (projectId !== null && projectId !== '') {
        params.unshift(`project_id=${projectId}`);
      }

      return `?${params.join('&')}`;
    }

    calcRemainingRequestCount(response, page) {
      return Math.floor(response.total_count / response.limit) + 1 - page;
    }

    keepIssues(issues) {
      issues.forEach(issue => {
        this.removeIssue(issue.id);
        this._issues.push(issue);
      });

      return this;
    }

    removeIssue(issueId) {
      this._issues = this._issues.filter(issue => {
        return issue.id !== issueId;
      });

      return this;
    }

    sortIssuesByUpdatedOn() {
      this._issues.sort((a, b) => {
        const dateA = new Date(a.updated_on);
        const dateB = new Date(b.updated_on);
        return dateA - dateB || a.id - b.id;
      });

      return this;
    }

    showIssues() {
      const issueCount = this._issues.length;

      if (issueCount === 0) {
        return this;
      }

      const now = new Date();
      const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      this._issues.forEach(issue => {
        const issueElementId = `issue-${issue.id}`;
        this.removeIssueElement(issueElementId);
        const issueElement = this.createIssueElement(issueElementId, issue, todayTime, this._settings.url);
        const column = document.getElementById(`column-status-${issue.status.id}`);
        column.insertBefore(issueElement, column.firstChild);
      });

      return this;
    }

    removeIssueElement(issueElementId) {
      const issueElement = document.getElementById(issueElementId);
      if (issueElement) {
        issueElement.parentNode.removeChild(issueElement);
      }

      return this;
    }

	formatDate(date, todayTime = null){
	  const year = date.getFullYear();
	  const month = `0${date.getMonth() + 1}`.slice(-2);
	  const day = `0${date.getDate()}`.slice(-2);
	  const hour = `0${date.getHours()}`.slice(-2);
	  const minute = `0${date.getMinutes()}`.slice(-2);
	  const dateTime = new Date(year, date.getMonth(), day).getTime();

	  if (todayTime === dateTime) {
		return `${hour}:${minute}`;
	  }
	  return `${year}-${month}-${day} ${hour}:${minute}`;
	};

    createIssueElement(issueElementId, issue, todayTime, url) {
      const issueElement = document.createElement('div');
      issueElement.id = issueElementId;
      issueElement.className = 'issue';

      const issueIdElement = document.createElement('div');
      issueIdElement.innerText = `#${issue.id}`;
      issueIdElement.className = 'issue-id';
      issueElement.appendChild(issueIdElement);

      const subjectElement = document.createElement('div');
      subjectElement.innerText = issue.subject;
      subjectElement.className = 'subject';
      issueElement.appendChild(subjectElement);

      const assignedTo = issue.assigned_to;
      if (assignedTo !== undefined) {
        const assignedToElement = document.createElement('div');
        assignedToElement.innerText = assignedTo.name;
        assignedToElement.className = 'assigned-to';
        issueElement.appendChild(assignedToElement);
      }

      const updatedOnElement = document.createElement('div');
      updatedOnElement.innerText = this.formatDate(new Date(issue.updated_on), todayTime);
      updatedOnElement.className = 'updated-on';
      issueElement.appendChild(updatedOnElement);

      issueElement.addEventListener('click', () => {
		window.open(`${url}/issues/${issue.id}`, '_blank');
      });

      return issueElement;
    }

    showTotalIssue() {
      const issueCount = this._issues.length;

      document.getElementById('total-issue-count').innerText = issueCount;

      const issueUnit = (issueCount === 0 || issueCount === 1) ? 'issue' : 'issues';
      document.getElementById('total-issue-unit').innerText = issueUnit;

      return this;
    }

    updateLastExecutionTime(date = new Date()) {
      const lastExecutionTime = date.toISOString().replace(/\.\d+Z$/, 'Z');
      localStorage.setItem('lastExecutionTime', lastExecutionTime);

      return this;
    }

    updateLastExecutionTimeWithBaseTime() {
      if (this._settings.baseTime !== null) {
        this.updateLastExecutionTime(new Date(this._settings.baseTime));
      }

      return this;
    }

    readStoredSettings() {
      this._settings = {
        url: localStorage.getItem('url'),
        apiKey: localStorage.getItem('apiKey'),
        projectId: localStorage.getItem('projectId'),
        updateInterval: localStorage.getItem('updateInterval'),
        baseTime: null
      };
	  
      return this;
    }

    validateSettings() {
      const url = this._settings.url;
      const apiKey = this._settings.apiKey;

      if (url === null || url === '' || apiKey === null || apiKey === '') {
        return false;
      }

      return true;
    }

    removeBaseTime() {
      localStorage.removeItem('baseTime');
      localStorage.removeItem('baseTimeValue');

      return this;
    }

    overlay() {
      const url = this._settings.url;
      const apiKey = this._settings.apiKey;
      const overlayElement = document.getElementById('no-setting');

      if (url === null || url === '' || apiKey === null || apiKey === '') {
        overlayElement.classList.add('overlay');
      } else {
        overlayElement.classList.remove('overlay');
      }

      return this;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('dark', isDarkMode);
  });

  window.addEventListener('load', () => {
    const redmineNow = new RedmineNow();
    redmineNow.initMenu()
      .initEventListener()
      .initStartupTime()
      .readStoredSettings()
      .overlay()
      .fetchIssueStatus()
      .updateLastExecutionTime(redmineNow._startupTime)
      .initFetch();
  });
})();

