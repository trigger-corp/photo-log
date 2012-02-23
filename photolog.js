// Constants used for configuration
var config = {
	parseAppId: 'QD9yEg6rZdAtirdSn02QQDFJp57pDnLfmwHqP4xa',
	parseRestKey: 'ZstsmIqn3BoShHopKGTSVdOPv7TrNk1NrjQjnb1P',
	defaultStream: 'launch',
	pageSize: 10
};

// Current state
var state = {
	animating: false,
	index: 0,
	location: null,
	stream: null,
	pageNum: 1
}

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
var setupTitle = function () {
	$('#page-title').text('#' + state.stream);
	$('#page-title').click(function(e) {
		e.preventDefault();
		photolog.router.navigate("/stream/" + state.stream, {trigger: true});
	});
}

var updatePhotos = function(increment) {
	state.pageNum = parseInt(state.pageNum, 10) + increment;
	var targetClassName = 'photoPage' + state.pageNum;
	setupNav();

	$('.photo').each(function() {
		if($(this).attr('class').indexOf(targetClassName) != -1) {
			$(this).fadeIn('slow');
		} else {
			$(this).hide();
		}
	});
};

var setupNav = function () {
	if(state.pageNum > 1) {
		$('#prev-link').show();
	} else {
		$('#prev-link').hide();
	}
	if(photolog.photos.length > state.pageNum * config.pageSize) {
		$('#next-link').show();
	} else {
		$('#next-link').hide();
	}
	if($('#prev-link').is(":visible") && $('#next-link').is(":visible")) {
		$('#nav-divider').show();
	} else {
		$('#nav-divider').hide();		
	}

	$('#next-link').unbind('click').click(function(e) {
		e.preventDefault();
		updatePhotos(1);
	});
	$('#prev-link').unbind('click').click(function(e) {
		e.preventDefault();
		updatePhotos(-1);
	});
}

var setupSearch = function() {
	$("#search-streams").bind("input", function() {
		var searchString = '#' + this.value.replace('#', '');
    	var results = false;
	    $(".photoStream").each(function(){
	    	if($(this).text().indexOf(searchString) == 0) {
	    		$(this).parent().show();
	    		results = true;
	    	} else {
	    		$(this).parent().hide();
	    	}
	    });
	    if(!results) {
	    	$('#no-results').show();
	    }
	});
}


// TODO: forge.geolocation should work everywhere, iOS only for now
if (forge.is.ios()) {
	forge.geolocation.getCurrentPosition(function (loc) {
		state.location = loc.coords
	});
} else if (forge.is.mobile() && navigator.geolocation) {
	navigator.geolocation.getCurrentPosition(function (loc) {
		state.location = loc.coords
	});
}

// Router
photolog.types.Router = Backbone.Router.extend({
	routes: {
		"": "listStreams",
		"upsell": "upsell",
		"upload": "upload",
		"photo/:stream/:photoId": "photo",
		"stream/:stream": "stream"
	},
	listStreams: function () {
		$('#streams').show();
		$('#photos').hide();
		$('#upload').remove();
		$('#upsell').hide();
		$('#scrollbox').hide();
		$('#page-title').text('');

		loading();
		forge.request.ajax({
			url: "https://api.parse.com/1/classes/Stream",
			headers: {
				"X-Parse-Application-Id": config.parseAppId,
				"X-Parse-REST-API-Key": config.parseRestKey
			},
			type: "GET",
			dataType: 'json',
			data: {
				"order": "-updatedAt"
			},
			success: function (data) {
				$('#streams ul').html('');
				data.results.forEach(function (stream) {
					$('#streams ul').append('<li><a class="photoStream" href="#stream/'+stream.stream+'">#'+stream.stream+'</a></li>');
				})
				loaded();
				setupSearch();
			},
			error: function () {
				loaded();
			}
		});
		
	},
	stream: function (stream) {
		// TODO: Use views rather than hardcoded
		if (!stream) {
			stream = config.defaultStream;
		}
		if (state.stream != stream) {
			state.stream = stream;

			// Remove current photos
			photolog.photos.reset();
			$('.loadedPhoto').remove();
			photolog.util.update(setupNav);
		}
		setupTitle();
		$('#photos').show();
		$('#upload').remove();
		$('#upsell').hide();
		$('#scrollbox').hide();
		$('#streams').hide();
		setupNav();
	},
	upsell: function () {
		// TODO: Detect iPhone/Android/Web and use appropriate message
		$('#scrollbox').hide();
		if (forge.is.web()) {
			$('#photos').hide();
			$('#upload').remove();
			$('#upsell').show();
			$('#streams').hide();
		} else {
			photolog.router.navigate('stream/'+state.stream, true);
		}
	},
	upload: function () {
		$('#upsell').hide();
		$('#photos').hide();
		$('#scrollbox').hide();
		$('#streams').hide();
		var page = new photolog.views.Upload();
		page.render().show();
	},
	photo: function (stream, photoId) {
		// TODO: Use views rather than hardcoded
		$('#photos').hide();
		$('#upload').remove();
		$('#upsell').hide();
		$('#scrollbox').hide();
		$('#streams').hide();
		if (state.stream != stream) {
			state.stream = stream;
		}
		setupTitle();
		photolog.util.update(function() { photolog.util.getIndividualPhoto(photoId); });
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
	update: function (callback) {
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
				"where": '{"stream": "'+state.stream+'"}',
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
				if (callback) {
					callback();
				}
			},
			error: function () {
				loaded();
			}
		});
	},
	getIndividualPhoto: function(photoId) {
		var photo = photolog.photos.get(photoId);
		state.index = photolog.photos.indexOf(photo);
		$(document).keydown(function(e){
		    if (e.keyCode == 37) {
   	    		photolog.util.showIndividualPhoto(-1);
		    } else if (e.keyCode == 39) {
   	    		photolog.util.showIndividualPhoto(1);
		    }
		});
		$('#large-photo').attr('src', photo.get('url'));
		$('#scrollbox').show();
	},
	showIndividualPhoto: function(increment) {
		if (state.animating) {
			return;
		}
		state.animating = true;
	    var nextPhoto = '';
	    // A null state.index means show the 'Upsell' box instead of a photo
		if (state.index == null) {
			state.index = increment == 1 ? 0 : photolog.photos.length - 1;
			nextPhoto = photolog.photos.at(state.index).get('url');
		} else {
	    	state.index += increment;
	    	if (state.index == -1 || state.index == photolog.photos.length) {
	    		state.index = null;
	    	}
			else {
				nextPhoto = photolog.photos.at(state.index).get('url');
			}
	    }

		var xShift = 500;
		$('#scrollbox').animate({
		    opacity: 0,
		    left: '+=' + increment * xShift
			}, {
			duration: 200,
			complete: function() {
				$('#scrollbox').css('left', -1 * increment * xShift);
				if(!nextPhoto) {
			    	$('#start-stream-header').show();
			    	$('#large-photo').hide();
				} else {
			    	$('#start-stream-header').hide();
			    	$('#large-photo').show();
				}
				$('#large-photo').attr('src', nextPhoto);
				$('#scrollbox').animate({
				    opacity: 1,
				    left: '+=' + increment * xShift
				}, {
					duration: 200
				});
				state.animating = false;}});
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
	var pageNum = Math.floor(index / config.pageSize) + 1;
	if (index == 0) {
		$('#header').after(photo.render(pageNum).el);
	} else {
		$(photolog.photos.at(index-1).get('el')).after(photo.render(pageNum).el);
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
		$(el).html('<table><tr><td><div class="photo"><div style="width: 220px;"><div class="button" id="choosephoto">Choose photo</div><div>Post to stream:<input type="text" id="streamid" value="#'+state.stream+'"></div><div class="button" id="uploadphoto">Upload</div><div class="button" id="uploadcancel">Cancel</div></div></div></td></tr></table>');
		return this;
	},
	show: function () {
		$('body').append(this.el);
	},
	cancel: function () {
		photolog.router.navigate('stream/'+state.stream, true);
	},
	upload: function () {
		if (!this.selImage) {
			alert("Please choose a photo to upload first!");
		} else {
			var stream = $('#streamid').val().replace(/#/g, '') || state.stream || config.defaultStream;
			photolog.router.navigate('stream/'+stream, true);
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
							},
							location: state.location,
							stream: stream
						}),
						success: function (file) {
							loaded();

							// Tweet
							forge.tabs.open("https://twitter.com/share?url=" + encodeURIComponent("http://photo-log.trigger.io/#photo/"+file.objectId) + "&text=" + encodeURIComponent("Just posted to Trigger Photolog #"+stream+" - "));

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
			
			// Update stream
			forge.request.ajax({
				url: "https://api.parse.com/1/classes/Stream",
				headers: {
					"X-Parse-Application-Id": config.parseAppId,
					"X-Parse-REST-API-Key": config.parseRestKey
				},
				type: "GET",
				dataType: 'json',
				data: {
					"where": '{"stream": "'+state.stream+'"}',
					"limit": 1
				},
				success: function (data) {
					if (data.results.length > 0) {
						// PUT requests don't work on all platforms right now
						// Update stream date
						forge.request.ajax({
							url: "https://api.parse.com/1/classes/Stream/"+data.results[0].objectId,
							headers: {
								"X-Parse-Application-Id": config.parseAppId,
								"X-Parse-REST-API-Key": config.parseRestKey
							},
							type: "PUT",
							contentType: "application/json",
							dataType: 'json',
							data: '{}'
						});
					} else {
						// Create stream
						forge.request.ajax({
							url: "https://api.parse.com/1/classes/Stream",
							headers: {
								"X-Parse-Application-Id": config.parseAppId,
								"X-Parse-REST-API-Key": config.parseRestKey
							},
							type: "POST",
							contentType: "application/json",
							dataType: 'json',
							data: JSON.stringify({
								stream: stream
							})
						});
					}
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

	render: function(pageNum) {
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
			$(el).html('<div style="display: inline-block; height: '+square*ratio+'px; width: '+square*ratio+'px; overflow: hidden"><a href="#photo/'+state.stream+'/' +photoId+'"><img style="width: '+preloadImage.width*ratio+'px; height: '+preloadImage.height*ratio+'px; margin-left: -'+widthOffset*ratio+'px; margin-top: -'+heightOffset*ratio+'px" src="'+preloadImage.src+'"></a></div>');
			if (pageNum == 1) {
				$(el).fadeIn('slow');
			}
			$(el).addClass('loadedPhoto photoPage' + pageNum)
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
		$('#upload-container').hide();
		if (navigator.userAgent.indexOf('Android') != -1) {
			$('#appstore').hide();
			photolog.router.navigate('upsell', true);
		} else if (navigator.userAgent.indexOf('iPhone') != -1 || navigator.userAgent.indexOf('iPad') != -1) {
			$('#androidmarket').hide();
			photolog.router.navigate('upsell', true);
		}
	} else {
		$('#app-download-container').hide();
	}
	// Check for photos then poll every 10 seconds, bit hacky.
	setInterval(function () {
		photolog.util.update();
	}, 10000);
});