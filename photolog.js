// Constants used for configuration
var config = {
	fbAppId: '265837806823447',
	parseAppId: 'QD9yEg6rZdAtirdSn02QQDFJp57pDnLfmwHqP4xa',
	parseRestKey: 'ZstsmIqn3BoShHopKGTSVdOPv7TrNk1NrjQjnb1P'
};
// Variables holding current app state
var state = {
	loggedIn: false,
	parseSession: null,
	parseUserId: null,
	fbAccessToken: null,
	fbId: null
};

// Organisation object
var photolog = {
	types: {},
	views: {},
	models: {},
	collections: {}
};

// TODO: Tidy up, currently just keeps track of any active ajax requests and shows a loading message
var loadCount = 0;
var loading = function () {
	loadCount++;
	$('#loading').show();
}
var loaded = function () {
	loadCount--;
	if (loadCount < 1) {
		$('#loading').hide();
	}
}

// Router
photolog.types.Router = Backbone.Router.extend({
	routes: {
		"": "home",
		"upsell": "upsell",
		"upload": "upload"
		// TODO: Individual photo page
	},
	home: function () {
		// TODO: Use views rather than hardcoded
		$('#photos').show();
		$('#upload').remove();
		$('#upsell').hide();
	},
	upsell: function () {
		// TODO: Detect iPhone/Android/Web and use appropriate message
		if (forge.is.web()) {
			$('#photos').hide();
			$('#upload').remove();
			$('#upsell').show();
		} else {
			photolog.router.navigate('', true);
		}
	},
	upload: function () {
		$('#upsell').hide();
		$('#photos').hide();
		var page = new photolog.views.Upload();
		page.render().show();
	}
});
photolog.router = new photolog.types.Router();

// Functions
photolog.util = {
	login: function () {
		if (state.loggedIn) {
			return;
		}
		var parseLogin = function () {
			forge.request.ajax({
				url: "https://api.parse.com/1/login",
				headers: {
					"X-Parse-Application-Id": config.parseAppId,
					"X-Parse-REST-API-Key": config.parseRestKey
				},
				type: "GET",
				dataType: 'json',
				data: {
					username: state.fbId,
					password: state.fbId
				},
				success: function (data) {
					// Logged in
					if (data.sessionToken) {
						state.parseSession = data.sessionToken;
						state.parseUserId = data.objectId;
						state.loggedIn = true;
						photolog.util.update();
						$('#login').text("Logged in.");
						$('#login').removeClass('button').addClass('text');
					} else {
						alert("Parse login error");
					}
					loaded();
				}, error: function (e) {
					// Try to register
					forge.request.ajax({
						url: "https://api.parse.com/1/users",
						headers: {
							"X-Parse-Application-Id": config.parseAppId,
							"X-Parse-REST-API-Key": config.parseRestKey
						},
						type: "POST",
						contentType: "application/json",
						dataType: 'json',
						data: JSON.stringify({
							username: state.fbId,
							password: state.fbId
						}),
						success: function (data) {
							if (data.sessionToken) {
								state.parseSession = data.sessionToken;
								state.parseUserId = data.objectId;
								state.loggedIn = true;
								photolog.util.update();
								$('#login').text("Logged in.");
								$('#login').removeClass('button').addClass('text');
							} else {
								alert("Parse registration error");
							}
							loaded();
						}, error: function (e) {
							alert("Parse registration error");
							loaded();
						}
					});
				}
			});
		}

		if (forge.is.mobile()) {
			forge.tabs.openWithOptions({
				url: 'https://www.facebook.com/dialog/oauth?client_id='+config.fbAppId+'&redirect_uri=fb'+config.fbAppId+'://authorize&display=touch&response_type=token',
				pattern: 'fb'+config.fbAppId+'://authorize/*'
			}, function (data) {
				// we are now at a URL matching the pattern given above, i.e. fb319333711443283://authorize/...
				// now we can pull out the Facebook authentication data from the URL query string
				var params = {}, queryString = data.url.substring(data.url.indexOf('#')+1),
					regex = /([^&=]+)=([^&]*)/g, m;
				while (m = regex.exec(queryString)) {
					params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
				}

				loading();
				// all authenticated - grab data for the current user
				forge.request.ajax({
					url: 'https://graph.facebook.com/me?access_token='+params['access_token'],
					dataType: 'json',
					success: function (data) {
						if (data.id) {
							state.fbAccessToken = params['access_token'];
							state.fbId = data.id;
							// Parse login
							parseLogin();
						} else {
							alert("Facebook login error");
							loaded();
						}
					}, error: function () {
						loaded();
					}
				});
			});
		} else {
			FB.login(function(response) {
				if (response.authResponse) {
					state.fbId = response.authResponse.userID;
					parseLogin();
				} else {
					alert('User cancelled login or did not fully authorize.');
					loaded();
				}
			});
		}
	},
	upload: function () {
		if (!forge.is.mobile()) {
			photolog.router.navigate('upsell', true);
			return;
		}
		if (!state.loggedIn) {
			alert("Please login to upload photos");
			return;
		}
		photolog.router.navigate('upload', true);
	},
	update: function () {
		loading();
		forge.request.ajax({
			url: "https://api.parse.com/1/classes/Photo",
			headers: {
				"X-Parse-Application-Id": config.parseAppId,
				"X-Parse-REST-API-Key": config.parseRestKey,
				"X-Parse-Session-Token": state.parseSession || ""
			},
			type: "GET",
			dataType: 'json',
			data: {
				"limit": 10,
				"order": "-createdAt"
			},
			success: function (data) {
				data.results.forEach(function (file) {
					if (!photolog.photos.get(file.objectId)) {
						photolog.photos.add([{
							id: file.objectId,
							url: file.file.url,
							timestamp: Date.parse(file.createdAt.replace('T', ' ').replace('Z','').substring(0, file.createdAt.indexOf('.'))).getTime(),
							user: file.user.objectId
						}]);
					}
				})
				loaded();
			},
			error: function () {
				loaded();
			}
		});
	}
}

// Models
photolog.models.Photo = Backbone.Model.extend({
});

// Collections
photolog.collections.Photos = Backbone.Collection.extend({
	model: photolog.models.Photo,
	comparator: function (model) {
		return -model.get('timestamp');
	}
});
photolog.photos = new photolog.collections.Photos();
photolog.photos.on('add', function (model) {
	var photo = new photolog.views.Photo({
		model: model
	});

	var index = photolog.photos.indexOf(model);
	loading();
	if (index == 0) {
		$('#header').after(photo.render().el);
	} else {
		$(photolog.photos.at(index-1).get('el')).after(photo.render().el);
	}
});

// Views
photolog.views.Upload = Backbone.View.extend({
	tagName: "div",
	id: "upload",
	events: {
		"click #uploadcancel": "cancel",
		"click #choosephoto": "choose",
		"click #uploadphoto": "upload"
	},
	render: function() {
		var el = this.el;
		$(el).html('<table><tr><td><div class="photo"><div style="width: 220px;"><div class="button" id="choosephoto">Choose photo</div><div class="button" id="uploadphoto">Upload</div><div class="button" id="uploadcancel">Cancel</div></div></div></td></tr></table>');
		return this;
	},
	show: function () {
		$('body').append(this.el);
	},
	cancel: function () {
		photolog.router.navigate('', true);
	},
	upload: function () {
		if (!this.selImage) {
			alert("Please choose a photo to upload first!");
		} else {
			photolog.router.navigate('', true);
			loading();
			forge.request.ajax({
				url: "https://api.parse.com/1/files/"+(new Date()).getTime()+".jpg",
				headers: {
					"X-Parse-Application-Id": config.parseAppId,
					"X-Parse-REST-API-Key": config.parseRestKey
				},
				type: "POST",
				files: [this.selImage],
				fileUploadMethod: 'raw',
				dataType: 'json',
				success: function (data) {
					var acl = {
						"*": {read: true}
					};
					acl[state.parseUserId] = {"read": true, "write": true};
					
					forge.request.ajax({
						url: "https://api.parse.com/1/classes/Photo",
						headers: {
							"X-Parse-Application-Id": config.parseAppId,
							"X-Parse-REST-API-Key": config.parseRestKey
						},
						type: "POST",
						contentType: "application/json",
						dataType: 'json',
						data: JSON.stringify({
							file: {
								"__type": "File",
								name: data.name
							},
							user: {
								"__type": "Pointer",
								className: "_User",
								objectId: state.parseUserId
							},
							"ACL": acl
						}),
						success: function (file) {
							loaded();
							photolog.photos.add([{
								id: file.objectId,
								url: data.url,
								timestamp: Date.parse(file.createdAt.replace('T', ' ').replace('Z','').substring(0, file.createdAt.indexOf('.'))).getTime(),
								user: state.parseUserId
							}]);
						}, error: function () {
							loaded();
						}
					});
				}, error: function () {
					loaded();
				}
			});
		}
	},
	choose: function () {
		var self = this;
		self.selImage = undefined;
		$('.toUpload').remove();
		forge.file.getImage({width: 500, height: 500}, function (file) {
			forge.file.imageURL(file, function (url) {
				var photo = new photolog.views.Photo({
					model: new photolog.models.Photo({url: url})
				});
				$('.photo', self.el).after(photo.render().el);
				$(photo.el).addClass("toUpload");
			});
			self.selImage = file;
		});
	}
});

photolog.views.Photo = Backbone.View.extend({
	tagName: "div",
	className: "photo",

	render: function() {
		var el = this.el;
		this.model.set('el', el);
		$(el).hide();
		var preloadImage = new Image();
		preloadImage.onload = function () {
			var square, heightOffset, widthOffset;
			if (preloadImage.height > preloadImage.width) {
				square = preloadImage.width;
				heightOffset = (preloadImage.height - square) / 2;
				widthOffset = 0;
			} else {
				square = preloadImage.height;
				widthOffset = (preloadImage.width - square) / 2;
				heightOffset = 0;
			}
			var target = 220;
			var ratio = target/square;
			$(el).html('<div style="display: inline-block; height: '+square*ratio+'px; width: '+square*ratio+'px; overflow: hidden"><img style="width: '+preloadImage.width*ratio+'px; height: '+preloadImage.height*ratio+'px; margin-left: -'+widthOffset*ratio+'px; margin-top: -'+heightOffset*ratio+'px" src="'+preloadImage.src+'"></div>');
			$(el).fadeIn('slow');
			loaded();
		}
		preloadImage.src = this.model.get('url');
		
		return this;
	}
});

// Initialise app
$(function () {
	if (!forge.is.mobile()) {
		FB.init({
			appId      : config.fbAppId,
			status     : true, 
			cookie     : true,
			xfbml      : false,
			oauth      : true,
		});
	}
	Backbone.history.start()
	if (forge.is.web()) {
		if (navigator.userAgent.indexOf('Android') != -1) {
			$('#appstore').hide();
			photolog.router.navigate('upsell', true);
		} else if (navigator.userAgent.indexOf('iPhone') != -1 || navigator.userAgent.indexOf('iPad') != -1) {
			$('#androidmarket').hide();
			photolog.router.navigate('upsell', true);
		}
	}
	// Check for photos then poll every 10 seconds, bit hacky.
	photolog.util.update();
	setInterval(function () {
		photolog.util.update();
	}, 10000);
});