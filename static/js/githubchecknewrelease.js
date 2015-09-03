/*
GitHub check-for-updates library
--------------------------------

Copyright (c) 2014 Pier Carlo Chiodi - http://www.pierky.com
Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT

https://github.com/pierky/githubchecknewrelease.js

Given the current version of a repository, this library checks for 
updated releases on GitHub. Data can be cached in order to perform
checks only at periodic intervals.

Requires:

	jQuery object, used for .ajax and .parseJSON

Usage:

	CheckNewRelease( {
		current_release: 'current_version',
		owner: 'repository_owner',
		repo: 'repository_name',

		done: function( Results ) {
		},

		// optional parameters
		instance: 'instance_id',
		include_pre_releases: true || false,
		check_interval: days,
		access_token: 'github_API_access_token',

		error: function( ErrorMessage ) {
		}
	} );

The current_release parameter must be set to the tag name of the
current release that identifies the version of the repository to
check updates for.

The instance parameter can be used to checks for multiple software 
on the same context. Cache data will be written locally using the 
instance tag to identify results.

The check_interval parameter is used to enable data caching.
It must be set with the number of days to wait between a check and
another. Cache works using browser's localStorage or cookie.

The access_token can be used to have a bigger rate-limit from GitHub.
Consider that rate-limit works on an IP address basis, so if used on
client-side applications it may be useless.

The 'done' callback function is executed to pass results to the caller.
It has one argument, Results:

	Results = {
		cached: true || false,
		new_release_found: true || false,

		// optional fields
		new_release: {
			version: 'version',
			name: 'name',
			published_at: 'date/time',
			prerelease: true || false,
			url: 'URL'
		},
		new_release_raw: <release object returned by GitHub API>
	}

- cached is set to true when no check has been performed and data is
returned from local cache;

- new_release is the object that describes the last release found on
GitHub; it's present only if new_release_found == true; version is 
the tag_name used on GitHub for the release.
*/

function CheckNewRelease_GetCookie( cname ) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i=0; i<ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1);
		if (c.indexOf(name) != -1) return c.substring(name.length,c.length);
	}
	return "";
}

function CheckNewRelease_SetCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function CheckNewRelease_WriteLocalData( args, name, val ) {
	var Instance;
	if( 'instance' in args ) {
		Instance = args['instance'];
	}

	if( 'localStorage' in window && window['localStorage'] !== null ) {
		localStorage.setItem( Instance ? 'CheckNewRelease_' + Instance + '_' + name : 'CheckNewRelease_' + name, val );
	} else {
		CheckNewRelease_SetCookie( Instance ? 'CheckNewRelease_' + Instance + '_' + name : 'CheckNewRelease_' + name, val, 'check_interval' in args ? args['check_interval']+1 : 30 );
	}
}

function CheckNewRelease_ReadLocalData( args, name ) {
	var Instance;
	if( 'instance' in args ) {
		Instance = args['instance'];
	}

	if( 'localStorage' in window && window['localStorage'] !== null ) {
		val = localStorage.getItem( Instance ? 'CheckNewRelease_' + Instance + '_' + name : 'CheckNewRelease_' + name );
	} else {
		val = CheckNewRelease_GetCookie( Instance ? 'CheckNewRelease_' + Instance + '_' + name : 'CheckNewRelease_' + name );
	}

	if( val ) {
		return val.trim();
	} else {
		return val;
	}
}

function CheckNewRelease_GetReleaseDetails( release ) {
	var Result = {};

	[ 'published_at', 'name', 'prerelease', [ 'version', 'tag_name' ], [ 'url', 'html_url' ] ].forEach( function(e) {
		var ResultField;
		var ReleaseField;

		if( typeof(e) == 'string' ) {
			ResultField = e;
			ReleaseField = e;
		} else {
			ResultField = e[0];
			ReleaseField = e[1];
		}

		if( ReleaseField in release ) {
			Result[ResultField] = release[ReleaseField];	
		} else {
			Result[ResultField] = '';
		}
	} );
	return Result;
}

function CheckNewRelease_GetReleases( args, PageNum, InternalData, done ) {
	var Owner = args['owner'];
	var Repo = args['repo'];
	var IncludePreReleases = 'include_pre_releases' in args ? args['include_pre_releases'] : false;

	if( !('Releases' in InternalData) ) {
		InternalData['Releases'] = new Array();
	}

	jQuery.ajax ( {
		url: 'https://api.github.com/repos/' + Owner + '/' + Repo + '/releases',
		data: {
			access_token: args['access_token'],
			'per_page': 30,
			'page': PageNum
		},
		dataType: 'jsonp',
		accepts: 'application/vnd.github.v3+json',
		contentType: 'application/json'

	} ).done( function( data ) {
		if( data['meta']['status'] == '200' ) {
			InternalData['Releases'].push.apply( InternalData['Releases'], data['data'] )

			IsLastPage = true;

			if( 'Link' in data['meta'] ) {
				for( LinkIdx in data['meta']['Link'] ) {
					if( data['meta']['Link'][LinkIdx][1]['rel'] == 'next' ) {
						IsLastPage = false;
						break;
					}
				}
			}

			if( IsLastPage ) {
				done();
			} else {
				CheckNewRelease_GetReleases( args, PageNum+1, InternalData, done );
			}
		} else {
			var Warning = 'WARNING: can\'t get data from GitHub; status ' + data['meta']['status'];
			if( 'data' in data ) {
				if( 'message' in data['data'] ) {
					Warning += ' - Message from GitHub: ' + data['data']['message'];
				}
			}
			console.log( Warning );
		}
	} ).error( function( jqXHR, textStatus, errorThrown ) {i
		if( 'error' in args ) {
			ErrMsg = '';
			try {
				ErrMsg += ': ' + textStatus;
				ErrMsg += '\n' + jqXHR.responseText;
			} finally {
				args['error']( ErrMsg );
			}
		}

	} );
}

function CheckNewRelease_FindLastRelease( args ) {
	var CurrentReleaseTag = args['current_release'];
	var Owner = args['owner'];
	var Repo = args['repo'];
	var IncludePreReleases = 'include_pre_releases' in args ? args['include_pre_releases'] : false;

	var InternalData = {};

	// obtain the list of all the releases
	CheckNewRelease_GetReleases( args, 1, InternalData, function() {

		// look for current release published_at
		var CurrentReleasePublishedAt;
		var CurrentRelease;
		for( ReleaseIdx in InternalData['Releases'] ) {
			CurrentRelease = InternalData['Releases'][ReleaseIdx];

			if( CurrentRelease['tag_name'] == CurrentReleaseTag ) {
				CurrentReleasePublishedAt = new Date( CurrentRelease['published_at'] );
				break;
			}
		}

		if( !CurrentReleasePublishedAt ) {
			console.log( 'WARNING: can\'find current release ' + CurrentReleaseTag + ' in the releases list of repository ' + Owner + '/' + Repo );
		} else {

			// find updated release
			var NewReleasePublishedAt;
			var NewRelease;
			for( ReleaseIdx in InternalData['Releases'] ) {
				ThisRelease = InternalData['Releases'][ReleaseIdx];

				if( ( ThisRelease['prerelease'] && IncludePreReleases ) || !ThisRelease['prerelease'] ) {
					ThisReleasePublishedAt = new Date( ThisRelease['published_at'] );

					if( ThisReleasePublishedAt > ( NewReleasePublishedAt || CurrentReleasePublishedAt ) ) {
						NewRelease = ThisRelease;
						NewReleasePublishedAt = ThisReleasePublishedAt
					}
				}
			}

			var Results = {
				'cached': false,
				'new_release_found': false
			};

			if( NewRelease ) {
				Results['new_release_found'] = true;
				Results['new_release_raw'] = NewRelease;
				Results['new_release'] = CheckNewRelease_GetReleaseDetails( NewRelease );

				CheckNewRelease_WriteLocalData( args, 'LastRelease', JSON.stringify( Results['new_release'] ) );
			} else {
				CheckNewRelease_WriteLocalData( args, 'LastRelease', '' );
			}

			CheckNewRelease_WriteLocalData( args, 'LastCheckedRelease', CurrentReleaseTag );
			CheckNewRelease_WriteLocalData( args, 'LastChecked', new Date() );

			args['done'](Results);
		}
	} );
}

function CheckNewRelease(args) {

	if( typeof(jQuery) == 'undefined' ) {
		throw 'jQuery not found';
	}

	if( 'done' in args ) {
		if( typeof( args['done'] ) != 'function' ) {
			throw 'Parameter used for callback \'done\' function is not a function';
		}
	} else {
		throw 'Required parameter missing: callback function "done"';
	}

	if( 'error' in args ) {
		if( typeof( args['error'] ) != 'function' ) {
			throw 'Parameter used for callback \'error\' function is not a function';
		}
	}

	if( 'current_release' in args ) {
		var CurrentRelease = args['current_release'];
	} else {
		throw 'Required parameter missing: current_release';
	}

	if( 'owner' in args ) {
		var Owner = args['owner'];
	} else {
		throw 'Required parameter missing: owner';
	}

	if( 'repo' in args ) {
		var Repo = args['repo'];
	} else {
		throw 'Required parameter missing: repo';
	}


	if( 'check_interval' in args ) {
		if( ! /^\+?[1-9]\d*$/.test( args['check_interval'] ) ) {
			throw 'Invalid value for check_interval: must be a positive integer';
		}

		var LastChecked = CheckNewRelease_ReadLocalData( args, 'LastChecked' );
		var LastCheckedRelease = CheckNewRelease_ReadLocalData( args, 'LastCheckedRelease' );

		if( LastChecked && LastChecked != '' && LastCheckedRelease && LastCheckedRelease == CurrentRelease ) {
			LastCheckedDateTime = new Date( LastChecked );

			NextCheckDateTime = new Date();
			NextCheckDateTime.setTime( LastCheckedDateTime.getTime() + ( parseInt( args['check_interval'] ) * 24*60*60*1000 ) );

			var Now = new Date();
			if( Now < NextCheckDateTime ) {
				var LastRelease = CheckNewRelease_ReadLocalData( args, 'LastRelease' );

				if( LastRelease && LastRelease != '' ) {
					LastRelease = jQuery.parseJSON( LastRelease );
					var Results = {
						'cached': true,
						'new_release': LastRelease,
						'new_release_found': true
					};
					args['done'](Results);						
				} 
				return;
			}
		}
	}

	CheckNewRelease_FindLastRelease( args )
}
