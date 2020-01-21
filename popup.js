'use strict';

let userID, currTaskList, currTaskListByTime, currTaskListByDue;

function googleSignin(interactive) {
	chrome.identity.getAuthToken({interactive: interactive}, function(token) {
		if (!chrome.runtime.lastError) {
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

					if (interactive) {
						$('.content-page').attr('transition', 'visibility 0s, opacity 1s linear');
					} else {
						$('.content-page').attr('transition', 'visibility 0s, opacity 0s linear');
					}

					$('.content-page').removeClass('hidden-content').addClass('visible-content');
					$('.sign-in-page').removeClass('visible-content').addClass('hidden-content'); 

					if (!$('.sign-in-error').hasClass('hidden-content')) {
						$('.sign-in-error').addClass('hidden-content');
					}
				})
				.then(resetDisplay);	
			} else {
				if (interactive) {
					$('.sign-in-error').removeClass('hidden-content');
				} else {
					return;
				}
			}
	});
}

function revokeToken() {
	chrome.identity.getAuthToken({ interactive: false }, function(current_token) {
		if (!chrome.runtime.lastError) {
			chrome.identity.removeCachedAuthToken({ token: current_token }, function(){});
			let xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' + current_token);
			xhr.send();

			$('.sign-in-page').removeClass('hidden-content').addClass('visible-content');
			$('.content-page').removeClass('visible-content').addClass('hidden-content');
			console.log('Succesfully revoked token.');
		}
	})
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
	$("#signInGoogle").on("click", function() {
		googleSignin(true);
	});

	/* Logout button */

	$(".logout-button").on("click", function() {
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

	googleSignin(false);

});


$(document).ready(function() {
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

	/* Delete a task */
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

			/* Remove this task */
			$(this).remove();
			resetOneList();

			/* Update count */
			const taskCount = (currTaskList ? currTaskList.length : 0);
			$('.task-count').html(taskCount);

			/* Check if the list is empty and display a message if it is */
			checkEmptyList();
		});
	});
})

