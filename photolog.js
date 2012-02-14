// Constants used for configuration
var config = {
	parseAppId: 'QD9yEg6rZdAtirdSn02QQDFJp57pDnLfmwHqP4xa',
	parseRestKey: 'ZstsmIqn3BoShHopKGTSVdOPv7TrNk1NrjQjnb1P'
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
		"upload": "upload",
		"photo/:photoId": "photo"
		// TODO: Individual photo page
	},
	home: function () {
		// TODO: Use views rather than hardcoded
		$('#photos').show();
		$('#upload').remove();
		$('#upsell').hide();
		$('#large-photo-container').hide();
	},
	upsell: function () {
		// TODO: Detect iPhone/Android/Web and use appropriate message
		$('#large-photo-container').hide();
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
		$('#large-photo-container').hide();
		var page = new photolog.views.Upload();
		page.render().show();
	},
	photo: function (photoId) {
		// TODO: Use views rather than hardcoded
		$('#photos').hide();
		$('#upload').remove();
		$('#upsell').hide();
		$('#large-photo-container').hide();
		photolog.util.getphoto(photoId);
	}
});
photolog.router = new photolog.types.Router();

// Functions
photolog.util = {
	upload: function () {
		if (!forge.is.mobile()) {
			photolog.router.navigate('upsell', true);
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
				"X-Parse-REST-API-Key": config.parseRestKey
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
							timestamp: Date.parse(file.createdAt.replace('T', ' ').replace('Z','').substring(0, file.createdAt.indexOf('.'))).getTime()
						}]);
					}
				})
				loaded();
			},
			error: function () {
				loaded();
			}
		});
	},
	getphoto: function(photoId) {
		forge.request.ajax({
			url: "https://api.parse.com/1/classes/Photo/" + photoId,
			headers: {
				"X-Parse-Application-Id": config.parseAppId,
				"X-Parse-REST-API-Key": config.parseRestKey
			},
			type: "GET",
			dataType: 'json',
			success: function (image) {
				$('#large-photo').attr('src', image.file.url);
				$('#large-photo-container').show();
			},
			error: function () {
				alert('Could not load photo');
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
							}
						}),
						success: function (file) {
							loaded();

							// Tweet
							forge.tabs.open("https://twitter.com/share?url=" + encodeURIComponent("http://photo-log.trigger.io/#photo/"+file.objectId) + "&text=" + encodeURIComponent("Just posted to Trigger Photolog - "));

							photolog.photos.add([{
								id: file.objectId,
								url: data.url,
								timestamp: Date.parse(file.createdAt.replace('T', ' ').replace('Z','').substring(0, file.createdAt.indexOf('.'))).getTime()
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
		var photoId = this.model.get('id');
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
			$(el).html('<div style="display: inline-block; height: '+square*ratio+'px; width: '+square*ratio+'px; overflow: hidden"><a href="#photo/'+photoId+'"><img style="width: '+preloadImage.width*ratio+'px; height: '+preloadImage.height*ratio+'px; margin-left: -'+widthOffset*ratio+'px; margin-top: -'+heightOffset*ratio+'px" src="'+preloadImage.src+'"></a></div>');
			$(el).fadeIn('slow');
			loaded();
		}
		preloadImage.src = this.model.get('url');

		return this;
	}
});

// Initialise app
$(function () {
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