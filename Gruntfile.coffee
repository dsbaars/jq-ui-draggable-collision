class GruntConfig
    constructor: (grunt) ->
        configs = require('load-grunt-configs')(grunt)
        grunt.initConfig(configs)
        require('load-grunt-tasks')(grunt)

module.exports = GruntConfig
