'use strict';


let userID, currTaskList, currTaskListByTime, currTaskListByDue;
let token_provider;
let fbToken;

function googleAuthorize(interactive) {
	chrome.identity.getAuthToken({interactive: interactive}, function(token) {
		if (!chrome.runtime.lastError) {
			token_provider = 'google';
			let init = {
				method: "GET",
				async: true,
				headers: {
					Authorization: 'Bearer' + token,
					'Content-Type': 'application/json'
				},
				'contentType': 'json'
			}; 

			/* Get user data, reset display and update the most recent lists*/
			fetch("https://www.googleapis.com/oauth2/v3/userinfo", init)
				.then((response) => response.json())
				.then(function(data) {
					userID = data.sub;
					const userName = data.name;
					const welcomeBlk = $("<span></span>").text(`Welcome, ${userName}!`).addClass("welcome-text");
					$('.user-info').append(welcomeBlk);

					$('.content-page').attr('transition', 'visibility 0s, opacity 0s linear');

					$('.content-page').removeClass('hidden-content').addClass('visible-content');
					$('.sign-in-page').removeClass('visible-content').addClass('hidden-content'); 

					if (!$('.sign-in-error').hasClass('hidden-content')) {
						$('.sign-in-error').addClass('hidden-content');
					}
				})
				.then(resetDisplay);
				return true;
			} else {
				if (interactive) {
					$('.sign-in-error').removeClass('hidden-content');
					return false;
				} else {
					return false;
				}
			}
	});
}

function fetchFacebookUserInfo(access_token, callback) {
	let xhr = new XMLHttpRequest();
	xhr.open('GET', 'https://graph.facebook.com/me');
	xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
	xhr.onload = () => {
		if (xhr.status == 200) {
			callback(JSON.parse(xhr.response));
		} else {
			console.log('Failed to get user info');
		}
	}
	xhr.send();
}

function updateFacebookUserInfo(response) {
	userID = response.id;
	const userName = response.name;
	const welcomeBlk = $("<span></span>").text(`Welcome, ${userName}!`).addClass("welcome-text");
	$('.user-info').append(welcomeBlk);

	$('.content-page').attr('transition', 'visibility 0s, opacity 0s linear');

	$('.content-page').removeClass('hidden-content').addClass('visible-content');
	$('.sign-in-page').removeClass('visible-content').addClass('hidden-content'); 

	if (!$('.sign-in-error').hasClass('hidden-content')) {
		$('.sign-in-error').addClass('hidden-content');
	};

	resetDisplay();		// reset lists
}

function facebookAuthorize(interactive) {
	const redirectURL = chrome.identity.getRedirectURL();
	const clientID = "795593944273495";
	const clientSecret = "fdbcf0c2ce5a3c7c9c1f359ab09590aa";
	const scopes = ["openid", "email", "profile"];

	let url = 'https://www.facebook.com/v5.0/dialog/oauth?client_id=' + clientID + 
	'&reponse_type=token&access_type=online&display=popup' + 
	'&redirect_uri=' + encodeURIComponent(redirectURL);

	chrome.identity.launchWebAuthFlow({
		interactive: interactive,
		url: url
	}, function(redirectedTo) {		// redirectedTo contains code
		if (!chrome.identity.lastError) {
			token_provider = 'facebook';
			const queryStr = redirectedTo.replace(chrome.identity.getRedirectURL() + "?", "");
			const urlParams = new URLSearchParams(queryStr);
			const code = urlParams.get('code');		// code to be exchanged for token 

			let xhr = new XMLHttpRequest();
			let codeURL = 'https://graph.facebook.com/oauth/access_token?' +
			'client_id=' + clientID + 
			'&client_secret=' + clientSecret + 
			'&redirect_uri=' + encodeURIComponent(redirectURL) + 
			'&code=' + code;

			xhr.open('GET', codeURL);
			xhr.onload = (e) => {
				let r = e.target;
				if (r.status == 200) {
					let response = JSON.parse(r.responseText);
					let params = new URLSearchParams(response);
					fbToken = params.get('access_token');
					fetchFacebookUserInfo(fbToken, updateFacebookUserInfo);		// fetch user info and update ui
				} else {
					console.log('Failed to exchange for token.');
					return;
				}
			}
			xhr.send();
		} else {
			if (interactive) {
				$('.sign-in-error').removeClass('hidden-content');
			} else {
				return;
			}
		};
	});
}

function revokeToken() {
	switch(token_provider) {
		case 'google':
			chrome.identity.getAuthToken({ interactive: false }, function(current_token) {
				if (!chrome.runtime.lastError) {
					chrome.identity.removeCachedAuthToken({ token: current_token }, function(){});
					let xhr = new XMLHttpRequest();
					xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' + current_token);
					xhr.send();

					$('.sign-in-page').removeClass('hidden-content').addClass('visible-content');
					$('.content-page').removeClass('visible-content').addClass('hidden-content');

					/* Set variables */
					token_provider = '';
					console.log('Succesfully revoked Google token.');
				}
			});
			break;
		case 'facebook': 
			const logOutUrl = "https://www.facebook.com/logout.php?" + 
			"next=" + encodeURIComponent(chrome.identity.getRedirectURL()) + 
			"&access_token=" + fbToken; 
			chrome.identity.launchWebAuthFlow({
				interactive: false,
				url: logOutUrl
			}, function() {
				$('.sign-in-page').removeClass('hidden-content').addClass('visible-content');
				$('.content-page').removeClass('visible-content').addClass('hidden-content');

				/* Set variables */ 
				fbToken = '';
				token_provider = '';
				console.log('Succesfully logged out of Facebook.');
			});
			break;
	};

	token_provider = '';
}

function compareTime(a, b) {
	if (a.time > b.time) return 1;
	if (a.time < b.time) return -1;

	return 0;
}

function compareDue(a, b) {
	if (!a.due && !b.due) return 0;
	if (!a.due) return 1;
	if (!b.due) return -1;

	const dueA = moment(a.due, 'YYYY-MM-DDTHH:mm');
	const dueB = moment(b.due, 'YYYY-MM-DDTHH:mm');

	if (dueA.isAfter(dueB)) return 1;
	if (dueA.isBefore(dueB)) return -1;

	return 0;
}

function resetListTime() {
	chrome.storage.sync.get(userID.toString(), function(result) {
		currTaskListByTime = result[userID].myTaskListByTime;
		$('ol.list-by-time').empty();
		for (const task of currTaskListByTime) {
			const taskName = task.name;
			const taskDue = task.due;
			const taskTime = task.time;

			const taskMins = taskTime % 60;
			const taskHrs = Math.floor(taskTime / 60);

			const taskDueStr = (taskDue ? moment(taskDue).format('MM/DD/YYYY @ hh:mm A') : "None");

			const currTask = `<li class="list-group-item list-group-item-secondary task-item"><div class="task-info"><p class="task-title"><span class="task-name">${taskName}</span></p><p class="task-description"><span>Deadline: <span class="task-due">${taskDueStr}</span>. </span></p><p class="task-description"><span>Time needed: <span class="task-hour">${taskHrs}</span> hours and <span class="task-minute">${taskMins}</span> minutes.</span></p></div><div class="task-delete"><a class="btn btn-danger delete-button" href="#" aria-label="Delete"><i class="fa fa-trash-o" aria-hidden="true"></i></a></div></li>`;
			$('ol.list-by-time').append(currTask);
		}
	})
}

function resetListDue() {
	chrome.storage.sync.get(userID.toString(), function(result) {
		currTaskListByDue = result[userID].myTaskListByDue;
		$('ol.list-by-due').empty();
		for (const task of currTaskListByDue) {
			const taskName = task.name;
			const taskDue = task.due;
			const taskTime = task.time;

			const taskMins = taskTime % 60;
			const taskHrs = Math.floor(taskTime / 60);

			const taskDueStr = (taskDue ? moment(taskDue).format('MM/DD/YYYY @ hh:mm A') : "None");

			const currTask = `<li class="list-group-item list-group-item-secondary task-item"><div class="task-info"><p class="task-title"><span class="task-name">${taskName}</span></p><p class="task-description"><span>Deadline: <span class="task-due">${taskDueStr}</span>. </span></p><p class="task-description"><span>Time needed: <span class="task-hour">${taskHrs}</span> hours and <span class="task-minute">${taskMins}</span> minutes.</span></p></div><div class="task-delete"><a class="btn btn-danger delete-button" href="#" aria-label="Delete"><i class="fa fa-trash-o" aria-hidden="true"></i></a></div></li>`;
			$('ol.list-by-due').append(currTask);
		}
	})
}

/* Reset the task list display*/
function resetDisplay() {

	// console.log(userID);

	/* Empty list to insert new list */ 
	$('ol.task-list').empty();

	/* Update local lists */
	chrome.storage.sync.get(userID.toString(), function(result) {
		currTaskList = result[userID].myTaskList;
		const taskCount = (currTaskList ? currTaskList.length : 0);
		$('.task-count').html(taskCount);
	});

	resetListTime();
	resetListDue();
	checkEmptyList(); 
}

/* Reset the task list display of only the unselected list (used when delete an item) */
function resetOneList() {
	const unselectedId = $('.category-button').not('.selected-btn').attr('id');
	if (unselectedId == 'category-button-1') {
		resetListTime();
	} else {
		resetListDue();
	}
}

/* Check if there is no task and display a message if empty */
function checkEmptyList() {
	if ($('.task-list.selected-btn li').length == 0 && $('.task-list li').not('.selected-btn').length == 1) {
		$('.empty-board').removeClass('hidden-content');
	}
}

$(window).on('load', function() {

	/* Google sign-in button */
	$('#signInGoogle').on('click', function() {
		googleAuthorize(true);
	});

	/* Facebook sign-in button */
	$('#signInFacebook').on('click', function() {
		facebookAuthorize(true);
	});

	/* Logout button */

	$('.logout-button').on('click', function() {
		revokeToken();
	});

	$('button.submit-btn').on('click', function() {
		const form = $('#quickAddForm');
		form.validate({
			errorPlacement: function(label, element) {
				label.addClass('form-error');
				label.insertAfter(element);
			},
			wrapper: 'span',
			messages: {
				tsk: 'Required',
				hrs: null,
				mins: null,
				dueDate: null
			}
		});
		if (form.valid() === false) {
			event.preventDefault();
			event.stopPropagation();
			form.addClass('was-validated');
			return;
		}

		form.addClass('was-validated');

		const $inputs = $("#quickAddForm :input");
		const vals = {}; 
		$inputs.each(function() {
			vals[this.name] = $(this).val();
		});
		const taskName = vals.tsk;
		const taskHrs = vals.hrs;
		const taskMins = vals.mins;
		const taskRequiredTime = 60 * Number(taskHrs) + Number(taskMins);
		const taskDue = (vals.dueDate ? moment(vals.dueDate, 'YYYY-MM-DDTHH:mm', true) : null);

		let taskDueStr, taskDueDate;
		if (taskDue === null) {
			taskDueStr = "None";
			taskDueDate = null;
		} else {
			taskDueStr = taskDue.clone().format('MM/DD/YYYY @ hh:mm A');
			taskDueDate = taskDue.format('YYYY-MM-DDTHH:mm');
		}

		const newTask = `<li class="list-group-item list-group-item-secondary task-item"><div class="task-info"><p class="task-title"><span class="task-name">${taskName}</span></p><p class="task-description"><span>Deadline: <span class="task-due">${taskDueStr}</span>. </span></p><p class="task-description"><span>Time needed: <span class="task-hour">${taskHrs}</span> hours and <span class="task-minute">${taskMins}</span> minutes.</span></p></div><div class="task-delete"><a class="btn btn-danger delete-button" href="#" aria-label="Delete"><i class="fa fa-trash-o" aria-hidden="true"></i></a></div></li>`;

		const currTask = {
			name: taskName,
			due: taskDueDate,
			time: taskRequiredTime
		}
		
		// chrome.storage.sync.clear();

		if (!currTaskList) {
			currTaskList = [currTask];
		} else {
			currTaskList.push(currTask);
		}

		currTaskListByTime = currTaskList.slice().sort(compareTime);
		currTaskListByDue = currTaskList.slice().sort(compareDue);

		let currUserObj = {};
		currUserObj[userID] = {
			myTaskList: currTaskList,
			myTaskListByTime: currTaskListByTime,
			myTaskListByDue: currTaskListByDue 
		} 

		chrome.storage.sync.set(currUserObj, function() {
			console.log("Saved. New unsorted list:", currTaskList);
		});

		$('ol.task-list').append(newTask);

		/* Update count */
		const taskCount = (currTaskList ? currTaskList.length : 0);
		$('.task-count').html(taskCount);
		
		if (!$('.empty-board').hasClass('hidden-content')) {
			$('.empty-board').addClass('hidden-content');
		}
	});
});


$(document).ready(function() {
	/* Attempt to login with Google's or Facebook's existed token */
	if (!googleAuthorize(false)) {
		facebookAuthorize(false);
	};

	/* Select category to view (sorted) tasks */
	$(".category-button[id^='category-button-']").on('click', function() {
		const selected_id = $(this).attr('id');
		$(".category-button[id^='category-button']").each(function() {
			if ($(this).attr('id') == selected_id) {
				$(this).addClass("selected-btn");
			} else {
				$(this).removeClass("selected-btn");
			}
		});

		const toShow = $($(this).attr('data-target'));
		toShow.show();
		$('ol.task-list').not(toShow).hide();
	});

	/* Refresh button */
	$('#refreshButton').on('click', function() {
		/* Animation */
		$(this).addClass("refresh-rotate").one("webkitAnimationEnd mozAnimationEnd animationend", function() {
			$(this).removeClass("refresh-rotate");
		})	

		/* Functionality */
		resetDisplay();
	});

	/* Delete a task (and all identical tasks) */
	$("ol.task-list").on("click", ".delete-button", function() {
		$(this).closest(".task-item").slideUp(200, function() {
			const taskName = $(this).find('.task-name').html();
			const taskDue = $(this).find('.task-due').html();
			const taskHrs = $(this).find('.task-hour').html();
			const taskMins = $(this).find('.task-minute').html();

			const taskDueStr = (taskDue === "None" ? null : moment(taskDue, 'MM/DD/YYYY @ hh:mm A', true).format('YYYY-MM-DDTHH:mm'));
			const taskTime = Number(taskHrs) * 60 + Number(taskMins);
			
			/* Filter and remove all identical items from all 3 lists */ 
			currTaskList = $.grep(currTaskList, function(obj) {
				return !(obj.name == taskName && obj.due == taskDueStr && obj.time == taskTime)
			});

			currTaskListByTime = $.grep(currTaskListByTime, function(obj) {
				return !(obj.name == taskName && obj.due == taskDueStr && obj.time == taskTime)
			});

			currTaskListByDue = $.grep(currTaskListByDue, function(obj) {
				return !(obj.name == taskName && obj.due == taskDueStr && obj.time == taskTime)
			});

			/* Update to storage */
			let currUserObj = {}
			currUserObj[userID] = {
				myTaskList: currTaskList,
				myTaskListByTime: currTaskListByTime,
				myTaskListByDue: currTaskListByDue 
			} 
			chrome.storage.sync.set(currUserObj, function() {
				console.log("Deleted. New unsorted list:", currTaskList);
			});

			/* Remove this task and its identical siblings */
			$(this).siblings().each(function() {
				console.log($(this));
				if ($(this).find('.task-name').html() == taskName && $(this).find('.task-due').html() == taskDue && $(this).find('.task-hour').html() == taskHrs && $(this).find('.task-minute').html() == taskMins) {
					$(this).slideUp(200, function() {
						$(this).remove();
					})
				}
			});
			$(this).remove();

			/* Reset the unselected (tab) list */
			resetOneList();

			/* Update count */
			const taskCount = (currTaskList ? currTaskList.length : 0);
			$('.task-count').html(taskCount);

			/* Check if the list is empty and display a message if it is */
			checkEmptyList();
		});
	});
})

