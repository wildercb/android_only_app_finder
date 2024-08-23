### Play store crawler + app store searcher = android only app finder

##### node top_games.mjs 
-> input appid to start crawl 
 find similar apps 
 (skips  developers that have already been seen on each pass) 
 (edit internal to set max count)

##### node app_play_comp.js 
-> input appid from crawl you would like to read through 
find apps that are only in play store
(if the name doesnt return an exact match, may be unnacurate)
