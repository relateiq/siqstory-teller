///<reference path="../typings/index.d.ts" />

import {SiqStoryTellerCtrl} from './SiqStoryTellerCtrl';

declare var angular;
declare var require;

export const name = 'SiqStoryTeller';

export const angularModule = angular.module(name, [
    require('./stuff/LibrarySrvc').name
])
    .directive('siqStoryTeller', function() {
        return {
            restrict: 'E',
            scope: {},
            controller: SiqStoryTellerCtrl,
            controllerAs: 'ctrl',
            template: require('./index.html')
        }
    });
