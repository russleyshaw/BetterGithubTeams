var Request = require('request');
var Util = require('util');
var _ = require('lodash');
var PP = require('./PaginationParser');
var Async = require('async');


function GitHub() {
    this.base_uri = 'https://api.github.com';
    this.bgt_filename = 'bgt.json';

    this.Options = function(path, access_token){
        return {
            'url': this.base_uri+path,
            "headers": {
                "authorization": Util.format("token %s", access_token),
                "accept": "application/vnd.github.v3+json",
                "content-type": "application/json",
                "user-agent": "BetterGithubTeams"
            }
        };
    };

    // callback(err, data)
    this._get = function (path, success_code, access_token, callback) {
        var options = this.Options(path, access_token);

        Request.get(options, function (error, response, body) {
            if (error) {
                callback(error, null);
            } else if (response.statusCode != success_code) {
                callback(Error('Code:'+response.statusCode+' Text: '+response.statusText), null);
            } else {
                callback(null, JSON.parse(body), response);
            }
        });
    };

    //callback(err, data)
    this._post = function (path, body, success_code, access_token, callback) {
        var options = this.Options(path, success_code);
        options.json = true;
        options.body = body;

        Request.post(options, function (error, response, body) {
            if (error) {
                callback(error, null);
            } else if (response.statusCode != success_code) {
                callback(Error('Code: '+response.statusCode+' Text: '+response.statusText), null);
            } else {
                callback(null, null);
            }
        });
    };

    //callback(err, data)
    this._patch = function (path, body, success_code, access_token, callback) {
        var options = this.Options(path, access_token);
        options.json = true;
        options.body = body;
        Request.patch(options, function (error, response, body) {
            if (error) {
                callback(error, null);
            } else if (response.statusCode != success_code) {
                callback(Error('Code:'+response.statusCode+' Text: '+response.statusText), null);
            } else {
                callback(null, null);
            }
        });
    };

    //callback(err, data)
    this._delete = function (path, success_code, access_token, callback) {
        var options = this.Options(path, access_token);

        Request.del(options, function (error, response, body) {
            if (error) {
                callback(error, null);
            } else if (response.statusCode !== success_code) {
                callback(response.statusText || response.statusCode, null);
            } else {
                callback(null, null);
            }
        });
    };

    // Gets the Authenticated User
    // callback(err, user)
    this.GetUser = function (access_token, callback) {
        this._get('/user', 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // Gets the user by username
    // callback(err, user)
    this.GetUserByUsername = function (username, access_token, callback) {
        this._get('/users/'+username, 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // Get the Organizations of the authenticated user.
    // callback(err, [orgs])
    this.GetBriefOrgs = function (access_token, callback) {
        this._get('/user/orgs', 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // Gets the Organization by the org login
    // callback(err, detailed_org)
    this.GetOrg = function (login, access_token, callback) {
        this._get('/orgs/'+login, 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // Gets the Organizations of the authenticated user.
    // callback(err, [orgs])
    this.GetOrgs = function (access_token, callback) {
        var self = this;

        self.GetBriefOrgs(access_token, function (err, brief_orgs) {
            if(err){callback(err, null);}

            //Map brief_orgs to orgs
            Async.map(brief_orgs,
                function(brief_org, callback1) {
                    self.GetOrg(brief_org.login, access_token, function(err, org){
                        callback1(err, org);
                    });
                },
                function(err, orgs) {
                    callback(err, orgs)
                }
            );
        });
    };

    // callback(err, created_team)
    this.CreateTeam = function(login, name, repos, permission, access_token, callback){
        require('request').debug= true;
        var options = this.Options('/orgs/'+login+'/teams', access_token);
        options.body = {
            "name": name,
            "repo_names": repos,
            "permission": permission
        };
        options.json = true;
        Request.post(options, function(err, resp, body){
            if(err){callback(err, null); return;}
            console.log(JSON.stringify(resp, null, 2));
            if(resp.statusCode != 201){callback(Error(resp.statusCode+' '+resp.statusText), null); return;}
            callback(err, body);
        });
        require('request').debug= false;
    };

    // callback(err);
    this.AddMemberToTeam = function(id, username, access_token, callback) {
        var options = this.Options('/teams/'+id+'/memberships/'+username, access_token);

        Request.put(options, function(err, resp, body){
            if(err){callback(err);}
            callback(null);
        });
    };

    // callback(err);
    this.DeleteTeam = function(id, access_token, callback){
        var options = this.Options('/teams/'+id, access_token);

        Request.del(options, function (err, resp, body) {
            if(err){ callback(err, null); return;}
            if(resp.statusCode != 204){ callback(Error(resp.statusCode+' '+resp.statusText), null); return;}

            callback(null);
        });
    };

    // callback(err, repo)
    this.GetRepo = function(owner, repo, access_token, callback){
        var options = this.Options('/repos/'+owner+'/'+repo, access_token);

        Request.get(options, function(err, resp, body){
            if(err){callback(err, null); return;}
            if(resp.statusCode != 200){callback(Error(resp.statusCode+': '+resp.statusText)); return;}

            callback(err, JSON.parse(body));
        });
    };

    // callback(err, [members], {links})
    this.GetOrgMembers = function(login, access_token, page, callback){

        var options = this.Options('/orgs/'+login+'/members?page='+page, access_token);

        Request.get(options, function(err, resp, body){
            if(err){callback(err, null); return;}
            if(resp.statusCode != 200){callback(Error(resp.statusCode+': '+resp.statusText)); return;}

            var pages = resp.headers.Link;

            callback(null, JSON.parse(body), pages);
        });
    };

    // callback(err, [repos])
    this.GetOrgRepos = function(login, access_token, page, callback){

        var options = this.Options('/orgs/'+login+'/repos?page='+page, access_token);

        Request.get(options, function(err, resp, body){
            if(err != null){callback(err, null); return;}
            if(resp.statusCode != 200){callback(Error(resp.statusCode+': '+resp.statusText)); return;}

            var pages = resp.headers.Link;

            callback(null, JSON.parse(body), pages);
        });
    };

    // Get brief teams by org login
    // callback(err, [teams])
    this.GetBriefTeams = function (login, access_token, callback) {
        this._get('/orgs/'+login+'/teams', 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // callback(err, [gists]) - gists don't have content
    this.ListGists = function (access_token, callback) {
        this._get('/gists', 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // callback(err, gist) - has content
    this.GetGist = function (id, access_token, callback) {
        this._get('/gists/'+id, 200, access_token, function (err, body) {
            callback(err, body);
        });
    };

    // callback(err);
    this.DeleteGist = function(id, access_token, callback) {
        this._delete('/gists/'+id, 204, access_token, function(err){
            callback(err);
        });
    };

    this.CreateGist = function(files, description, is_public, access_token, callback) {
        var options = this.Options('/gists', access_token);
        options.json = true;
        options.body = {
            "description": description,
            "public": is_public,
            "files": files
        };

        Request.post(options, function(err, response, body){
            if(err){callback(err); return;}
            if(response.statusCode !== 201){callback(Error('Code: '+response.statusCode+' Text: '+response.statusText)); return;}
            callback(null);
        });
    };

    /**************************************************************************
     * Advanced Github
     */

    // callback(err, id) - file is json
    this.GetBGTJsonId = function (access_token, callback) {
        var self = this;
        self.ListGists(access_token, function (err, gists) {
            if (err) {callback(err, null); return;}
            //Check all gists
            for(var i = 0; i < gists.length; i++) {
                //If it has the bgt file
                if(_.has(gists[i].files, self.bgt_filename)) {
                    callback(null, gists[i].id);
                    return;
                }
            }
            callback(null, null);
        });
    };

    // callback(err, file) - file is json
    this.GetBGTJson = function(access_token, callback) {
        var self = this;
        self.GetBGTJsonId(access_token, function(err, id){

            if(err){callback(err, null); return;}
            if(id == null) {callback(null, null); return;}

            self.GetGist(id, access_token, function(err, gist){
                if(err){callback(err, null); return;}

                callback(null, JSON.parse(gist.files[self.bgt_filename].content));
            });
        });
    };

    // callback(err)
    this.CreateBGTJson = function(access_token, callback) {
        var self = this;
        self.GetBGTJsonId(access_token, function(err, id){

            if(err){callback(err); return;}
            if(id != null){callback(Error('Gist with file '+self.bgt_filename+' already exists.')); return;}

            var files = {};
            var desc = 'This is the Better Github Teams gist. Please don\'t modify this file.';
            files[self.bgt_filename] = {
                "content": '{"_teamstodelete":[]}'
            };

            self.CreateGist(files, desc, false, access_token, function(err, data){
                if(err){callback(err); return;}

                callback(null);
            });
        });
    };

    // callback(err)
    this.DeleteBGTJson = function(access_token, callback){
        var self = this;
        self.GetBGTJsonId(access_token, function(err, id){
            if(err != null){callback(err); return;}
            if(id == null){callback(Error('BGT json already exists.')); return;}

            self.DeleteGist(id, access_token, function(err){
                if(err != null){callback(err); return;}

                callback(null);
            })
        });
    };

    // callback(err)
    this.UpdateBGTJson = function(json, access_token, callback) {
        var self = this;
        self.GetBGTJsonId(access_token, function(err, id){
            if(err){callback(err); return;}
            if(id == null){callback(Error('BGT json doesn\'t exist.')); return;}

            var body = {
                "files": {}
            };
            body.files[self.bgt_filename] = {
                "content": JSON.stringify(json, null, 2)
            };
            self._patch('/gists/'+id, body, 200, access_token, function(err, body){
                callback(err);
            });
        });
    };

    this._update_read = function(login, bgteam, access_token, callback) {
        var self = this;
        var repos = _.map(bgteam.read_repos, function(repo){
            return repo.owner+'/'+repo.name; // owner/repo
        });
        if(bgteam.read_id == null) {//CREATE TEAM IF NULL
            self.CreateTeam(login, 'BGT-'+bgteam.name+'-READ', repos, 'pull', access_token, function(err, team){
                if(err){  callback(err, null);  }
                else{  callback(err, team.id);  }
            });
        }
        else {//DELETE AND RECREATE
            self.DeleteTeam(bgteam.read_id, access_token, function(err){
                if(err){  callback(err, null);  }
                else {
                    self.CreateTeam(login, 'BGT-'+bgteam.name+'-READ', repos, 'pull', access_token, function(err, team){
                        if(err){  callback(err, null);  }
                        else{  callback(err, team.id);  }
                    });
                }
            });
        }
    };

    this._update_write = function(login, bgteam, access_token, callback) {
        var self = this;
        var repos = _.map(bgteam.write_repos, function(repo){
            return repo.owner+'/'+repo.name; // owner/repo
        });
        if(bgteam.write_id == null) {//CREATE TEAM IF NULL
            self.CreateTeam(login, 'BGT-'+bgteam.name+'-WRITE', repos, 'push', access_token, function(err, team){
                if(err){  callback(err, null);  }
                else{  callback(err, team.id);  }
            });
        }
        else {//DELETE AND RECREATE
            self.DeleteTeam(bgteam.write_id, access_token, function(err){
                if(err){  callback(err, null);  }
                else {
                    self.CreateTeam(login, 'BGT-'+bgteam.name+'-WRITE', repos, 'push', access_token, function(err, team){
                        if(err){  callback(err, null);  }
                        else{  callback(err, team.id);  }
                    });
                }
            });
        }
    };

    this._update_admin = function(login, bgteam, access_token, callback) {
        var self = this;
        var repos = _.map(bgteam.admin_repos, function(repo){
            return repo.owner+'/'+repo.name; // owner/repo
        });
        if(bgteam.admin_id == null) {//CREATE TEAM IF NULL
            self.CreateTeam(login, 'BGT-'+bgteam.name+'-ADMIN', repos, 'admin', access_token, function(err, team){
                if(err){  callback(err, null);  }
                else{  callback(err, team.id);  }
            });
        }
        else {//DELETE AND RECREATE
            self.DeleteTeam(bgteam.admin_id, access_token, function(err){
                if(err){  callback(err, null);  }
                else {
                    self.CreateTeam(login, 'BGT-'+bgteam.name+'-ADMIN', repos, 'admin', access_token, function(err, team){
                        if(err){  callback(err, null);  }
                        else{  callback(err, team.id);  }
                    });
                }
            });
        }
    };

    // callback(err);
    this.UpdateGitHubFromBGTJson = function(login, access_token, callback){
        var self = this;

        self.GetBGTJson(access_token, function(err, json){
            if(err){ throw err;}

            if(Object.keys(json[login]).length > 0){
                _.forOwn(json[login], function(bgteam){    //For each BGTeam

                    Async.parallel({
                        "read_id": function(callback1){
                            self._update_read(login, bgteam, access_token, function(err, id){
                                callback1(err, id);
                            });
                        },
                        "write_id": function(callback1){
                            self._update_write(login, bgteam, access_token, function(err, id){
                                callback1(err, id);
                            });
                        },
                        "admin_id": function(callback1){
                            self._update_admin(login, bgteam, access_token, function(err, id){
                                callback1(err, id);
                            });
                        }
                    }, function(err, result){
                        if(err){throw err;}

                        //Set team IDS
                        json[login][bgteam.name].read_id = result.read_id;
                        json[login][bgteam.name].write_id = result.write_id;
                        json[login][bgteam.name].admin_id = result.admin_id;

                        //Add users
                        _.forEach(json[login][bgteam.name].users, function(username){
                            if(result.read_id != null){
                                self.AddMemberToTeam(result.read_id, username, access_token, function(err){
                                    if(err){throw err;}
                                });
                            }
                            if(result.write_id != null) {
                                self.AddMemberToTeam(result.write_id, username, access_token, function(err){
                                    if(err){throw err;}
                                });
                            }
                            if(result.admin_id != null) {
                                self.AddMemberToTeam(result.admin_id, username, access_token, function(err){
                                    if(err){throw err;}
                                });
                            }
                        });

                        //Delete to_delete
                        _.forEach(json._teamstodelete, function(team_id){
                            self.DeleteTeam(team_id, access_token, function(err){
                                if(err){throw err;}
                            });
                        });
                        json._teamstodelete= [];

                        self.UpdateBGTJson(json, access_token, function(err){
                            if(err){throw err;}
                        });
                    });
                });
                callback(null);
            }
            else {
                //Delete to_delete
                self.GetBGTJson(access_token, function(err, json){
                    if(err){callback(err); return;}
                    if(json == null){callback(Error('No BGT json found.')); return;}

                    _.forEach(json._teamstodelete, function(team_id){
                        self.DeleteTeam(team_id, access_token, function(err){
                            if(err){throw err;}
                            console.log('Deleted');
                        });
                    });

                    json._teamstodelete= [];

                    self.UpdateBGTJson(json, access_token, function(err){
                        if(err){callback(err); return;}
                        callback(null);
                    });
                });
            }
        });
    };
}

module.exports = new GitHub();