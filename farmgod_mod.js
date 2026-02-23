ScriptAPI.register('FarmGod_Mod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');
window.FarmGod = {};
window.FarmGod.Library = (function () {
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () { if (this.queues === null) { this.queues = this.queueLib.createQueues(5); } },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) { this.action = action; this.arguments = arg; this.promise = promise; this.attempts = 0; },
        Queue: function () {
          this.list = []; this.working = false; this.length = 0;
          this.doNext = function () {
            let item = this.dequeue(); let self = this;
            if (item.action == 'openWindow') {
              window.open(...item.arguments).addEventListener('DOMContentLoaded', function () { self.start(); });
            } else {
              $[item.action](...item.arguments)
                .done(function () { item.promise.resolve.apply(null, arguments); self.start(); })
                .fail(function () {
                  item.attempts += 1;
                  if (item.attempts < twLib.queueLib.maxAttempts) { self.enqueue(item, true); } 
                  else { item.promise.reject.apply(null, arguments); }
                  self.start();
                });
            }
          };
          this.start = function () { if (this.length) { this.working = true; this.doNext(); } else { this.working = false; } };
          this.dequeue = function () { this.length -= 1; return this.list.shift(); };
          this.enqueue = function (item, front = false) { front ? this.list.unshift(item) : this.list.push(item); this.length += 1; if (!this.working) { this.start(); } };
        },
        createQueues: function (amount) { let arr = []; for (let i = 0; i < amount; i++) { arr[i] = new twLib.queueLib.Queue(); } return arr; },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues.map((q) => q.length).reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) { let promise = $.Deferred(); let item = new twLib.queueLib.Item(type, arg, promise); twLib.queueLib.addItem(item); return promise; },
      },
      ajax: function () { return twLib.queueLib.orchestrator('ajax', arguments); },
      get: function () { return twLib.queueLib.orchestrator('get', arguments); },
      post: function () { return twLib.queueLib.orchestrator('post', arguments); },
      openWindow: function () { let item = new twLib.queueLib.Item('openWindow', arguments); twLib.queueLib.addItem(item); },
    };
    twLib.init();
  }
  const setUnitSpeeds = function () {
    let unitSpeeds = {};
    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml).find('config').children().map((i, el) => { unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber(); });
      localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
    });
  };
  const getUnitSpeeds = function () { return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false; };
  if (!getUnitSpeeds()) setUnitSpeeds();
  const determineNextPage = function (page, $html) {
    let villageLength = $html.find('#scavenge_mass_screen').length > 0 ? $html.find('tr[id*="scavenge_village"]').length : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
    let navLength = $html.find('#am_widget_Farm').length > 0 ? parseInt($('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item')[$('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item').length - 1].textContent.replace(/\D/g, '')) - 1 : navSelect.length > 0 ? navSelect.find('option').length - 1 : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize = $('#mobileHeader').length > 0 ? 10 : parseInt($html.find('input[name="page_size"]').val());
    if (page == -1 && villageLength == 1000) { return Math.floor(1000 / pageSize); } else if (page < navLength) { return page + 1; }
    return false;
  };
  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;
    return twLib.ajax({ url: url + pageText }).then((html) => { return wrapFn(page, $(html)); });
  };
  const processAllPages = function (url, processorFn) {
    let page = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    let wrapFn = function (page, $html) { let dnp = determineNextPage(page, $html); if (dnp) { processorFn($html); return processPage(url, dnp, wrapFn); } else { return processorFn($html); } };
    return processPage(url, page, wrapFn);
  };
  const getDistance = function (origin, target) { let a = origin.toCoord(true).x - target.toCoord(true).x; let b = origin.toCoord(true).y - target.toCoord(true).y; return Math.hypot(a, b); };
  const subtractArrays = function (array1, array2) { let result = array1.map((val, i) => { return val - array2[i]; }); return result.some((v) => v < 0) ? false : result; };
  const getCurrentServerTime = function () { let [hour, min, sec, day, month, year] = $('#serverTime').closest('p').text().match(/\d+/g); return new Date(year, month - 1, day, hour, min, sec).getTime(); };
  const timestampFromString = function (timestr) {
    let d = $('#serverDate').text().split('/').map((x) => +x);
    let todayPattern = new RegExp(window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')).exec(timestr);
    let tomorrowPattern = new RegExp(window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')).exec(timestr);
    let laterDatePattern = new RegExp(window.lang['0cb274c906d622fa8ce524bcfbb7552d'].replace('%1', '([\\d+|\\.]+)').replace('%2', '([\\d+|:]+)')).exec(timestr);
    let t, date;
    if (todayPattern !== null) { t = todayPattern[1].split(':'); date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0); } 
    else if (tomorrowPattern !== null) { t = tomorrowPattern[1].split(':'); date = new Date(d[2], d[1] - 1, d[0] + 1, t[0], t[1], t[2], t[3] || 0); } 
    else { d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x); t = laterDatePattern[2].split(':'); date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0); }
    return date.getTime();
  };
  String.prototype.toCoord = function (objectified) { let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop(); return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c; };
  String.prototype.toNumber = function () { return parseFloat(this); };
  Number.prototype.toNumber = function () { return parseFloat(this); };
  return { getUnitSpeeds, processPage, processAllPages, getDistance, subtractArrays, getCurrentServerTime, timestampFromString };
})();

window.FarmGod.Translation = (function () {
  const msg = {
    int: {
      missingFeatures: 'Script requires a premium account and loot assistent!',
      options: {
        title: 'FarmGod (Smart 1Hr Mod)',
        warning: '<b>Warning:</b><br>- Make sure A is set as your default microfarm and C is ready<br>- Filters must be set correctly',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Send farms from group:',
        distance: 'Maximum fields for farms:',
        time: 'Time in minutes between farms:',
        losses: 'Send farm to villages with partial losses:',
        maxloot: 'Send template C if report < 1 hour (else A):',
        newbarbs: 'Add new barbs te farm:',
        button: 'Plan farms',
      },
      table: { noFarmsPlanned: 'No farms can be sent.', origin: 'Origin', target: 'Target', fields: 'fields', farm: 'Farm', goTo: 'Go to' },
      messages: { villageChanged: 'Successfully changed village!', villageError: 'All farms for the current village have been sent!', sendError: 'Error: farm not send!' },
    }
  };
  const get = function () { return msg['int']; };
  return { get };
})();

window.FarmGod.Main = (function (Library, Translation) {
  const lib = Library; const t = Translation.get(); let curVillage = null; let farmBusy = false;
  const init = function () {
    if (game_data.features.Premium.active && game_data.features.FarmAssistent.active) {
      if (game_data.screen == 'am_farm') {
        $.when(buildOptions()).then((html) => {
          Dialog.show('FarmGod', html);
          $('.optionButton').off('click').on('click', () => {
            let optionGroup = parseInt($('.optionGroup').val()); let optionDistance = parseFloat($('.optionDistance').val());
            let optionTime = parseFloat($('.optionTime').val()); let optionLosses = $('.optionLosses').prop('checked');
            let optionMaxloot = $('.optionMaxloot').prop('checked'); let optionNewbarbs = $('.optionNewbarbs').prop('checked') || false;
            localStorage.setItem('farmGod_options', JSON.stringify({ optionGroup: optionGroup, optionDistance: optionDistance, optionTime: optionTime, optionLosses: optionLosses, optionMaxloot: optionMaxloot, optionNewbarbs: optionNewbarbs }));
            $('.optionsContent').html(UI.Throbber[0].outerHTML + '<br><br>');
            getData(optionGroup, optionNewbarbs, optionLosses).then((data) => {
              Dialog.close(); let plan = createPlanning(optionDistance, optionTime, optionMaxloot, data);
              $('.farmGodContent').remove(); $('#am_widget_Farm').first().before(buildTable(plan.farms));
              bindEventHandlers(); UI.InitProgressBars();
              UI.updateProgressBar($('#FarmGodProgessbar'), 0, plan.counter);
              $('#FarmGodProgessbar').data('current', 0).data('max', plan.counter);
            });
          });
          document.querySelector('.optionButton').focus();
        });
      } else { location.href = game_data.link_base_pure + 'am_farm'; }
    } else { UI.ErrorMessage(t.missingFeatures); }
  };
  const bindEventHandlers = function () {
    $('.farmGod_icon').off('click').on('click', function () {
      if (game_data.market != 'nl' || $(this).data('origin') == curVillage) { sendFarm($(this)); } else { UI.ErrorMessage(t.messages.villageError); }
    });
    $(document).off('keydown').on('keydown', (event) => { if ((event.keyCode || event.which) == 13) { $('.farmGod_icon').first().trigger('click'); } });
    $('.switchVillage').off('click').on('click', function () { curVillage = $(this).data('id'); UI.SuccessMessage(t.messages.villageChanged); $(this).closest('tr').remove(); });
  };
  const buildOptions = function () {
    let options = JSON.parse(localStorage.getItem('farmGod_options')) || { optionGroup: 0, optionDistance: 25, optionTime: 10, optionLosses: false, optionMaxloot: true, optionNewbarbs: true };
    return $.when(buildGroupSelect(options.optionGroup)).then((groupSelect) => {
      return `<style>#popup_box_FarmGod{text-align:center;width:550px;}</style>
              <h3>${t.options.title}</h3><br><div class="optionsContent">
              <div class="info_box" style="line-height: 15px;font-size:10px;text-align:left;"><p style="margin:0px 5px;">${t.options.warning}</p></div><br>
              <div style="width:90%;margin:auto;background: url('graphic/index/main_bg.jpg') 100% 0% #E3D5B3;border: 1px solid #7D510F;"><table class="vis" style="width:100%;text-align:left;font-size:11px;">
                <tr><td>${t.options.group}</td><td>${groupSelect}</td></tr>
                <tr><td>${t.options.distance}</td><td><input type="text" size="5" class="optionDistance" value="${options.optionDistance}"></td></tr>
                <tr><td>${t.options.time}</td><td><input type="text" size="5" class="optionTime" value="${options.optionTime}"></td></tr>
                <tr><td>${t.options.losses}</td><td><input type="checkbox" class="optionLosses" ${options.optionLosses ? 'checked' : ''}></td></tr>
                <tr><td><b>${t.options.maxloot}</b></td><td><input type="checkbox" class="optionMaxloot" ${options.optionMaxloot ? 'checked' : ''}></td></tr>
              </table></div><br><input type="button" class="btn optionButton" value="${t.options.button}"></div>`;
    });
  };
  const buildGroupSelect = function (id) {
    return $.get(TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })).then((groups) => {
      let html = `<select class="optionGroup">`;
      groups.result.forEach((val) => { if (val.type == 'separator') { html += `<option disabled=""/>`; } else { html += `<option value="${val.group_id}" ${val.group_id == id ? 'selected' : ''}>${val.name}</option>`; } });
      html += `</select>`; return html;
    });
  };
  const buildTable = function (plan) {
    let html = `<div class="vis farmGodContent"><h4>FarmGod</h4><table class="vis" width="100%">
                <tr><div id="FarmGodProgessbar" class="progress-bar live-progress-bar progress-bar-alive" style="width:98%;margin:5px auto;"><div style="background: rgb(146, 194, 0);"></div><span class="label" style="margin-top:0px;"></span></div></tr>
                <tr><th style="text-align:center;">${t.table.origin}</th><th style="text-align:center;">${t.table.target}</th><th style="text-align:center;">${t.table.fields}</th><th style="text-align:center;">${t.table.farm}</th></tr>`;
    if (!$.isEmptyObject(plan)) {
      for (let prop in plan) {
        plan[prop].forEach((val, i) => {
          html += `<tr class="farmRow row_${i % 2 == 0 ? 'a' : 'b'}">
                    <td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.origin.id}">${val.origin.name} (${val.origin.coord})</a></td>
                    <td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.target.id}">${val.target.coord}</a></td>
                    <td style="text-align:center;">${val.fields.toFixed(2)}</td>
                    <td style="text-align:center;"><a href="#" data-origin="${val.origin.id}" data-target="${val.target.id}" data-template="${val.template.id}" class="farmGod_icon farm_icon farm_icon_${val.template.name}" style="margin:auto;"></a></td>
                  </tr>`;
        });
      }
    } else { html += `<tr><td colspan="4" style="text-align: center;">${t.table.noFarmsPlanned}</td></tr>`; }
    html += `</table></div>`; return html;
  };
  const getData = function (group, newbarbs, losses) {
    let data = { villages: {}, commands: {}, farms: { templates: {}, farms: {} } };
    let villagesProcessor = ($html) => {
      let skipUnits = ['ram', 'catapult', 'knight', 'snob', 'militia'];
      $html.find('#combined_table').find('.row_a, .row_b').filter((i, el) => { return $(el).find('.bonus_icon_33').length == 0; }).map((i, el) => {
        let $el = $(el); let $qel = $el.find('.quickedit-label').first();
        let units = $el.find('.unit-item').filter((index, element) => { return skipUnits.indexOf(game_data.units[index]) == -1; }).map((index, element) => { return $(element).text().toNumber(); }).get();
        return (data.villages[$qel.text().toCoord()] = { name: $qel.data('text'), id: parseInt($el.find('.quickedit-vn').first().data('id')), units: units });
      }); return data;
    };
    let commandsProcessor = ($html) => {
      $html.find('#commands_table').find('.row_a, .row_ax, .row_b, .row_bx').map((i, el) => {
        let $el = $(el); let coord = $el.find('.quickedit-label').first().text().toCoord();
        if (coord) { if (!data.commands.hasOwnProperty(coord)) data.commands[coord] = []; return data.commands[coord].push(Math.round(lib.timestampFromString($el.find('td').eq(2).text().trim()) / 1000)); }
      }); return data;
    };
    let farmProcessor = ($html) => {
      if ($.isEmptyObject(data.farms.templates)) {
        let unitSpeeds = lib.getUnitSpeeds();
        $html.find('form[action*="action=edit_all"]').find('input[type="hidden"][name*="template"]').closest('tr').map((i, el) => {
          let $el = $(el);
          return (data.farms.templates[$el.prev('tr').find('a.farm_icon').first().attr('class').match(/farm_icon_(.*)\s/)[1]] = {
            id: $el.find('input[type="hidden"][name*="template"][name*="[id]"]').first().val().toNumber(),
            units: $el.find('input[type="text"], input[type="number"]').map((index, element) => { return $(element).val().toNumber(); }).get(),
            speed: Math.max(...$el.find('input[type="text"], input[type="number"]').map((index, element) => { return $(element).val().toNumber() > 0 ? unitSpeeds[$(element).attr('name').trim().split('[')[0]] : 0; }).get())
          });
        });
      }
    data.farms.templates['c'] = { id: 'c', units: [0,0,0,0,0,0,0,0,0,0,0,0], speed: 10 };
    $html.find('#plunder_list').find('tr[id^="village_"]').map((i, el) => {
        let $el = $(el);
        let tds = $el.find('td'); let timeText = "";
        for (let j = 0; j < tds.length; j++) {
            let text = $(tds[j]).text().toLowerCase();
            if (text.includes(':') && (text.includes('วัน') || text.includes('today') || text.includes('yesterday') || text.match(/\d+\.\d+/))) { timeText = text; break; }
        }
        let diffHours = 999;
        if (timeText) {
            let now = new Date(); let reportTime = new Date(now.getTime()); let timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1], 10); let minutes = parseInt(timeMatch[2], 10);
                if (timeText.includes('เมื่อวาน') || timeText.includes('yesterday')) { reportTime.setDate(now.getDate() - 1); } 
                else if (!timeText.includes('วัน') && !timeText.includes('today')) {
                    let dateMatch = timeText.match(/(\d{1,2})\.(\d{1,2})\./);
                    if (dateMatch) { reportTime.setDate(parseInt(dateMatch[1], 10)); reportTime.setMonth(parseInt(dateMatch[2], 10) - 1); }
                }
                reportTime.setHours(hours, minutes, 0, 0);
                diffHours = (now.getTime() - reportTime.getTime()) / (1000 * 60 * 60);
            }
        }
        return (data.farms.farms[$el.find('a[href*="screen=report&mode=all&view="]').first().text().toCoord()] = {
          id: $el.attr('id').split('_')[1].toNumber(),
          color: $el.find('img[src*="graphic/dots/"]').attr('src').match(/dots\/(green|yellow|red|blue|red_blue)/)[1],
          age_hours: diffHours, has_c: $el.find('a.farm_icon_c').length > 0
        });
      });
      return data;
    };
    let filterFarms = () => {
      data.farms.farms = Object.fromEntries(Object.entries(data.farms.farms).filter(([key, val]) => { return (!val.hasOwnProperty('color') || (val.color != 'red' && val.color != 'red_blue' && (val.color != 'yellow' || losses))); }));
      return data;
    };
    return Promise.all([
      lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group: group }), villagesProcessor),
      lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'commands', type: 'attack' }), commandsProcessor),
      lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), farmProcessor)
    ]).then(filterFarms).then(() => { return data; });
  };
  const createPlanning = function (optionDistance, optionTime, optionMaxloot, data) {
    let plan = { counter: 0, farms: {} }; let serverTime = Math.round(lib.getCurrentServerTime() / 1000);
    for (let prop in data.villages) {
      let orderedFarms = Object.keys(data.farms.farms).map((key) => { return { coord: key, dis: lib.getDistance(prop, key) }; }).sort((a, b) => (a.dis > b.dis ? 1 : -1));
      orderedFarms.forEach((el) => {
        let farmIndex = data.farms.farms[el.coord];
        let template_name = 'a';
      
console.log('Village: ' + el.coord + ' | Report Age: ' + farmIndex.age_hours + ' hrs | Has C: ' + farmIndex.has_c);
if (optionMaxloot && farmIndex.has_c && farmIndex.age_hours <= 1.5) {
template_name = 'c';
console.log('>>> Selected: C');
}
        if (!data.farms.templates.hasOwnProperty(template_name)) { template_name = 'a'; }
        let template = data.farms.templates[template_name];
        let unitsLeft = lib.subtractArrays(data.villages[prop].units, template.units);
        let distance = lib.getDistance(prop, el.coord);
        let arrival = Math.round(serverTime + distance * template.speed * 60 + Math.round(plan.counter / 5));
        let maxTimeDiff = Math.round(optionTime * 60); let timeDiff = true;
        if (data.commands.hasOwnProperty(el.coord)) {
          if (!farmIndex.hasOwnProperty('color') && data.commands[el.coord].length > 0) timeDiff = false;
          data.commands[el.coord].forEach((timestamp) => { if (Math.abs(timestamp - arrival) < maxTimeDiff) timeDiff = false; });
        } else { data.commands[el.coord] = []; }
        if (unitsLeft && timeDiff && distance < optionDistance) {
          plan.counter++;
          if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];
          plan.farms[prop].push({ origin: { coord: prop, name: data.villages[prop].name, id: data.villages[prop].id }, target: { coord: el.coord, id: farmIndex.id }, fields: distance, template: { name: template_name, id: template.id } });
          data.villages[prop].units = unitsLeft; data.commands[el.coord].push(arrival);
        }
      });
    }
    return plan;
  };
  const sendFarm = function ($this) {
    let n = Timing.getElapsedTimeSinceLoad();
    if (!farmBusy && !(Accountmanager.farm.last_click && n - Accountmanager.farm.last_click < 200)) {
      farmBusy = true; Accountmanager.farm.last_click = n; let $pb = $('#FarmGodProgessbar');
      TribalWars.post(Accountmanager.send_units_link.replace(/village=(\d+)/, 'village=' + $this.data('origin')), null, { target: $this.data('target'), template_id: $this.data('template'), source: $this.data('origin') },
        function (r) { UI.SuccessMessage(r.success); $pb.data('current', $pb.data('current') + 1); UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max')); $this.closest('.farmRow').remove(); farmBusy = false; },
        function (r) { UI.ErrorMessage(r || t.messages.sendError); $pb.data('current', $pb.data('current') + 1); UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max')); $this.closest('.farmRow').remove(); farmBusy = false; }
      );
    }
  };
  return { init };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => { window.FarmGod.Main.init(); })();
