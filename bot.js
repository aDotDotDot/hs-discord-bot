var Discord = require('discord.io');
var logger = require('winston');
var deckstrings = require('deckstrings');
var request = require('request');
var auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
    token: auth.token,
    autorun: true
});
var decode_hs_code = function(hscode){
    return deckstrings.decode(hscode);
};

var send_bot_msg = function(channelID, msg, embed){
    bot.sendMessage({
        to: channelID,
        message: msg,
        embed: embed
    });
};
function compare_cards(aObj,bObj){
    var a = aObj['card'];
    var b = bObj['card'];
    if (parseInt(a['cost']) < parseInt(b['cost']))
        return -1;
    if (parseInt(a['cost']) > parseInt(b['cost']))
        return 1;
    //at this point, cost is the same, let's try by name
    if (a['name'] < b['name'])
        return -1
    if (a['name'] > b['name'])
        return 1
    return 0;
}

var analyse_deck = function(deck){
    var cost = {"LEGENDARY":0, "EPIC":0, "RARE":0,"COMMON":0}
    for( var i in deck){
        cost[deck[i]['card']['rarity']]+=1;
    }
    return cost;
};

var format_deck = function(deck, hearthpwnUrl){
//deck = list of object card + count
    deck = deck.sort(compare_cards);

    var embedtxt = "";
    for(var i in deck){
        embedtxt+= deck[i]['count'] + "\* **" + deck[i]['card']['name'] + "** (" +deck[i]['card']['cost'] + ")\n";
    }
    cost = analyse_deck(deck);
    return {
        color: 6826080,
        footer: {
            text: ""
        },
        fields: [{
            name: "**__Cartes__**",
            value: embedtxt
        },
            {
                name: "**__Coût à Craft__**",
                value: 1600*cost["LEGENDARY"]+400*cost["EPIC"]+100*cost["RARE"]+40*cost["COMMON"]
            },
            {
                name: "**__Visualiser__**",
                value: "Clique [ici]("+hearthpwnUrl+") !"
            }
        ],
        title: 'Description du deck',
        url: ''
    }
};
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
                break;
            case 'decode':
                try{
                    var deck_obj = decode_hs_code(args[0]);
                }catch(errorC){
                    send_bot_msg(channelID, 'Deck Invalide');
                }
                if(deck_obj){
                    request('https://api.hearthstonejson.com/v1/latest/frFR/cards.json', {json: true}, function(error, response, body) {
                        if(error) { console.log(error); }
                        var byDbfId = {};
                        for(var i in body){
                            byDbfId[body[i]['dbfId']] = body[i];
                        }
                        //console.log(byDbfId);
                        var deck = decode_hs_code(args[0]);
                        var deck_cards = [];
                        for(var card in deck['cards']){
                            deck_cards.push({card: byDbfId[deck['cards'][card][0]], count:deck['cards'][card][1]})
                        }
                        request('https://www.hearthpwn.com/ajax/getdeckstring?deckString='+args[0], {json: true}, function(err, response2, body2) {
                            if(err) { console.log(err); }
                            var hearthpwnUrl = "https://www.hearthpwn.com"+body2['RedirectUrl'];
                            //send_bot_msg(channelID, JSON.stringify(decode_hs_code(args[0])), format_deck(deck_cards, hearthpwnUrl));
                            send_bot_msg(channelID, "Deck identifié, voilà mon analyse : ", format_deck(deck_cards, hearthpwnUrl));
                        });
                    });
                }
                break;
            // Just add any case commands if you want to..
        }
    }
});
