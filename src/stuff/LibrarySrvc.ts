///<reference path="../../typings/index.d.ts" />

declare var angular;
declare var require;

import {SiqStoryTwist} from 'siqstory-journalist/.src/types';

export const name = 'LibrarySrvc';

export const angularModule = angular.module(name, [
])
    .factory('LibrarySrvc', function($q, $http) {
        return {
            getLatestStory: function() {
                return $http({ method: 'get', url: 'https://4kz2iij01i.execute-api.us-east-1.amazonaws.com/production/lastStory' })
                    .then(function(results) {
                        return results && results.data && results.data.twists && JSON.parse(results.data.twists);
                    });
            }
        }
    });
