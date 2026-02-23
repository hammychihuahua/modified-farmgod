ScriptAPI.register('FarmGod_Smart_v2', true, 'Warre', 'nl.tribalwars@coma.innogames.de');
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
  
  const getCurrentServerTime = function () {
    try {
        let textMatch = $('#serverTime').closest('p').text().match(/\d+/g);
        if (textMatch && textMatch.length >= 6) {
            let [hour, min, sec, day, month, year] = textMatch;
            return new Date(year, month - 1, day, hour, min, sec).getTime();
        }
    } catch(e) {}
    return new Date().getTime();
  };

  const timestampFromString = function (timestr) {
    try {
        let serverNow = new Date(getCurrentServerTime());
        let tMatch = timestr.match(/(\d{1,2}):(\d{2}):(\d{2})/);
        if (!tMatch) {
            tMatch = timestr.match(/(\d{1,2}):(\d{2})/);
            if (!tMatch) return serverNow.getTime();
        }
        let rT = new Date(serverNow.getTime());
        rT.setHours(parseInt(tMatch[1], 10), parseInt(tMatch[2], 10), tMatch[3] ? parseInt(tMatch[3], 10) : 0, 0);

        let tLower = timestr.toLowerCase();
        if (tLower.includes('yesterday') || tLower.includes('เมื่อวาน')) {
            rT.setDate(serverNow.getDate() - 1);
        } else if (!tLower.includes('today') && !tLower.includes('วันนี้')) {
            let dM = timestr.match(/(\d{1,2})\.(\d{1,2})\./);
            if (dM) {
                rT.setDate(parseInt(dM[1], 10));
                rT.setMonth(parseInt(dM[2], 10) - 1);
            }
        }
        return rT.getTime();
    } catch(e) { return new Date().getTime(); }
  };

  String.prototype.toCoord = function (objectified) { let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop(); return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c; };
  String.prototype.toNumber = function () { return parseFloat(this); };
  Number.prototype.toNumber = function () { return parseFloat(this); };
  return { getUnitSpeeds, processPage, processAllPages, getDistance, subtractArrays, getCurrentServerTime, timestampFromString };
})();

window.FarmGod.Translation = (function () {
  const msg = {
    int: {
      missingFeatures: 'Script requires a premium account!',
      options: {
        title: 'FarmGod Smart v2',
        warning: '<b>คำแนะนำ:</b> ติ๊กช่องสุดท้ายเพื่อส่งปุ่ม C ถ้ารายงานอายุ < 1.5 ชม.',
        filterImage: '',
        group: 'ส่งจากกลุ่ม:',
        distance: 'ระยะทางสูงสุด:',
        time: 'เวลาพัก (นาที):',
        losses: 'ส่งเมืองที่มีทหารตาย (เหลือง):',
        maxloot: 'ส่งปุ่ม C ถ้ารายงาน < 1.5 ชม. (ถ้าไม่ใช่ส่ง A):',
        newbarbs: 'Add new barbs:',
        button: 'วางแผนส่งฟาร์ม',
      },
      table: { noFarmsPlanned: 'ไม่มีเมืองให้ส่งฟาร์ม', origin: 'หมู่บ้าน', target: 'เป้าหมาย', fields: 'ระยะ', farm: 'ส่ง', goTo: 'Go to' },
      messages: { villageChanged: 'เปลี่ยนหมู่บ้านสำเร็จ!', villageError: 'เมืองนี้ส่งครบแล้ว!', sendError: 'Error!' },
    }
  };
  return { get: function () { return msg['int']; } };
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
            let optionMaxloot = $('.optionMaxloot').prop('checked');
            localStorage.setItem('farmGod_options', JSON.stringify({ optionGroup, optionDistance, optionTime, optionLosses, optionMaxloot }));
            $('.optionsContent').html(UI.Throbber[0].outerHTML + '<br><br>');
            
            getData(optionGroup, false, optionLosses).then((data) => {
              Dialog.close(); let plan = createPlanning(optionDistance, optionTime, optionMaxloot, data);
              $('.farmGodContent').remove(); $('#am_widget_Farm').first().before(buildTable(plan.farms));
              bindEventHandlers(); UI.InitProgressBars();
              UI.updateProgressBar($('#FarmGodProgessbar'), 0, plan.counter);
              $('#FarmGodProgessbar').data('current', 0).data('max', plan.counter);
            }).catch(err => {
              Dialog.close(); UI.ErrorMessage("Error: ไม่สามารถโหลดข้อมูลได้");
            });
          });
        });
      } else { location.href = game_data.link_base_pure + 'am_farm'; }
    } else { UI.ErrorMessage(t.missingFeatures); }
  };
  const bindEventHandlers = function () {
    $('.farmGod_icon').off('click').on('click', function (e) { e.preventDefault(); sendFarm($(this)); });
    $(document).off('keydown').on('keydown', (e) => { if (13 == (e.keyCode || e.which)) { e.preventDefault(); $('.farmGod_icon').first().trigger('click'); } });
  };
  const buildOptions = function () {
    let options = JSON.parse(localStorage.getItem('farmGod_options')) || { optionGroup: 0, optionDistance: 15, optionTime: 10, optionLosses: false, optionMaxloot: true };
    return $.when(buildGroupSelect(options.optionGroup)).then((groupSelect) => {
      return `<style>#popup_box_FarmGod{text-align:center;width:550px;}</style>
              <h3>${t.options.title}</h3><br><div class="optionsContent">
              <div class="info_box" style="text-align:left;"><p>${t.options.warning}</p></div><br>
              <table class="vis" style="width:100%;text-align:left;">
                <tr><td>${t.options.group}</td><td>${groupSelect}</td></tr>
                <tr><td>${t.options.distance}</td><td><input type="text" size="5" class="optionDistance" value="${options.optionDistance}"></td></tr>
                <tr><td>${t.options.time}</td><td><input type="text" size="5" class="optionTime" value="${options.optionTime}"></td></tr>
                <tr><td>${t.options.losses}</td><td><input type="checkbox" class="optionLosses" ${options.optionLosses ? 'checked' : ''}></td></tr>
                <tr><td style="color:red; font-weight:bold;">${t.options.maxloot}</td><td><input type="checkbox" class="optionMaxloot" ${options.optionMaxloot ? 'checked' : ''}></td></tr>
              </table><br><input type="button" class="btn optionButton" value="${t.options.button}"></div>`;
    });
  };
  const buildGroupSelect = function (id) {
    return $.get(TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })).then((groups) => {
      let html = `<select class="optionGroup">`;
      groups.result.forEach((val) => { html += `<option value="${val.group_id}" ${val.group_id == id ? 'selected' : ''}>${val.name}</option>`; });
      return html + `</select>`;
    });
  };
  const buildTable = function (plan) {
    let html = `<div class="vis farmGodContent"><h4>FarmGod V2</h4><table class="vis" width="100%">
                <tr><div id="FarmGodProgessbar" class="progress-bar" style="width:98%;margin:5px auto;"><div style="background: rgb(146, 194, 0);"></div><span class="label"></span></div></tr>
                <tr><th>${t.table.origin}</th><th>${t.table.target}</th><th>${t.table.fields}</th><th>${t.table.farm}</th></tr>`;
    if (!$.isEmptyObject(plan)) {
      for (let prop in plan) {
        plan[prop].forEach((val, i) => {
          html += `<tr class="farmRow row_${i % 2 == 0 ? 'a' : 'b'}">
                    <td align="center">${val.origin.name}</td>
                    <td align="center">${val.target.coord}</td>
                    <td align="center">${val.fields.toFixed(2)}</td>
                    <td align="center"><a href="#" data-origin="${val.origin.id}" data-target="${val.target.id}" data-template="${val.template.id}" class="farmGod_icon farm_icon farm_icon_${val.template.name}"></a></td>
                  </tr>`;
        });
      }
    } else { html += `<tr><td colspan="4" align="center">${t.table.noFarmsPlanned}</td></tr>`; }
    return html + `</table></div>`;
  };
  const getData = function (group, newbarbs, losses) {
    let data = { villages: {}, commands: {}, farms: { templates: {}, farms: {} } };
    return Promise.all([
      lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group: group }), ($h) => {
        $h.find('#combined_table .row_a, #combined_table .row_b').filter((i, el) => $(el).find('.bonus_icon_33').length == 0).map((i, el) => {
          let $el = $(el), $q = $el.find('.quickedit-label').first();
          let u = $el.find('.unit-item').map((idx, e) => $(e).text().toNumber()).get();
          data.villages[$q.text().toCoord()] = { name: $q.data('text'), id: parseInt($el.find('.quickedit-vn').first().data('id')), units: u };
        });
      }),
      lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'commands', type: 'attack' }), ($h) => {
        $h.find('#commands_table tr.row_a, #commands_table tr.row_b').map((i, el) => {
          let $el = $(el), c = $el.find('.quickedit-label').first().text().toCoord();
          if (c) { if (!data.commands[c]) data.commands[c] = []; data.commands[c].push(Math.round(lib.timestampFromString($el.find('td').eq(2).text().trim()) / 1000)); }
        });
      }),
      lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), ($h) => {
        if ($.isEmptyObject(data.farms.templates)) {
          let s = lib.getUnitSpeeds();
          $h.find('form[action*="action=edit_all"] a.farm_icon').each(function() {
            let $icon = $(this);
            let nameMatch = $icon.attr('class').match(/farm_icon_([a-b])/);
            if (nameMatch) {
              let name = nameMatch[1];
              let $row = $icon.closest('tr');
              let idInput = $row.find('input[name*="[id]"]');
              if (idInput.length) {
                data.farms.templates[name] = { 
                  id: parseInt(idInput.val(), 10), 
                  units: $row.find('input[type="text"]').map((idx, e) => parseInt($(e).val(), 10) || 0).get(), 
                  speed: 10 
                };
              }
            }
          });
          let cUnits = new Array(game_data.units.length).fill(0);
          let lcIdx = game_data.units.indexOf('light');
          if (lcIdx > -1) cUnits[lcIdx] = 2;
          data.farms.templates['c'] = { id: 'c', units: cUnits, speed: s['light'] || 10 };
        }
        
        let serverNow = new Date(lib.getCurrentServerTime());
        $h.find('#plunder_list tr[id^="village_"]').each(function() {
          let $el = $(this);
          let coordAnchor = $el.find('a[href*="screen=report"]').first();
          if (!coordAnchor.length) return;
          let coord = coordAnchor.text().toCoord();
          if (!coord) return;
          
          let timeText = "";
          $el.find('td').each(function() {
              let text = $(this).text().toLowerCase();
              if (text.includes(':') && (text.includes('today') || text.includes('yesterday') || text.includes('วันนี้') || text.includes('เมื่อวาน') || text.match(/\d+\.\d+/))) {
                  timeText = text;
              }
          });
          
          let dH = 999;
          if (timeText) {
            let rT = new Date(serverNow.getTime());
            let tM = timeText.match(/(\d{1,2}):(\d{2})/);
            if (tM) {
              rT.setHours(parseInt(tM[1], 10), parseInt(tM[2], 10), 0, 0);
              if (timeText.includes('yesterday') || timeText.includes('เมื่อวาน')) {
                  rT.setDate(serverNow.getDate() - 1);
              } else if (!timeText.includes('today') && !timeText.includes('วันนี้')) {
                  let dM = timeText.match(/(\d{1,2})\.(\d{1,2})\./);
                  if (dM) {
                      rT.setDate(parseInt(dM[1], 10));
                      rT.setMonth(parseInt(dM[2], 10) - 1);
                  }
              }
              dH = (serverNow.getTime() - rT.getTime()) / 36e5;
              if (dH < 0) dH += 24; 
            }
          }

          let colorMatch = $el.find('img[src*="dots/"]').attr('src');
          data.farms.farms[coord] = { 
            id: parseInt($el.attr('id').split('_')[1], 10), 
            color: colorMatch ? colorMatch.match(/dots\/(.*)\.png/)[1] : 'blue', 
            has_c: $el.find('[class*="farm_icon_c"]').length > 0, 
            age_h: dH 
          };
        });
      })
    ]).then(() => {
      data.farms.farms = Object.fromEntries(Object.entries(data.farms.farms).filter(([k, v]) => v.color != 'red' && (v.color != 'yellow' || losses)));
      return data;
    });
  };
  const createPlanning = function (dis, time, maxL, data) {
    let plan = { counter: 0, farms: {} }, now = Math.round(lib.getCurrentServerTime() / 1000);
    for (let s in data.villages) {
      Object.keys(data.farms.farms).map(k => ({ k, d: lib.getDistance(s, k) })).sort((a, b) => a.d - b.d).forEach(f => {
        let v = data.farms.farms[f.k];
        let tN = 'a';
        
        if (maxL && v.has_c && v.age_h <= 1.5) { tN = 'c'; }
        if (!data.farms.templates.hasOwnProperty(tN)) { tN = 'a'; }
        
        let temp = data.farms.templates[tN];
        let tempId = (tN === 'c') ? 'c' : temp.id;
        
        let units = lib.subtractArrays(data.villages[s].units, temp.units);
        let arrival = Math.round(now + f.d * temp.speed * 60 + Math.round(plan.counter / 5));
        let maxTimeDiff = Math.round(time * 60); 
        let timeDiff = true;
        
        if (data.commands.hasOwnProperty(f.k)) {
          data.commands[f.k].forEach(ts => { if (Math.abs(ts - arrival) < maxTimeDiff) timeDiff = false; });
        } else { data.commands[f.k] = []; }

        if (units && timeDiff && f.d < dis) {
          plan.counter++; if (!plan.farms[s]) plan.farms[s] = [];
          plan.farms[s].push({ origin: { id: data.villages[s].id, name: data.villages[s].name }, target: { coord: f.k, id: v.id }, fields: f.d, template: { name: tN, id: tempId } });
          data.villages[s].units = units;
          data.commands[f.k].push(arrival);
        }
      });
    }
    return plan;
  };
  const sendFarm = function ($t) {
    if (farmBusy) return; farmBusy = true;
    let targetId = parseInt($t.attr('data-target'), 10);
    let templateId = $t.attr('data-template');
    
    // บังคับใช้ฟังก์ชันดั้งเดิมของเกมเพื่อแก้ Error "Template has not been created yet"
    if (typeof Accountmanager !== 'undefined' && Accountmanager.farm && Accountmanager.farm.sendUnits) {
        Accountmanager.farm.sendUnits($t[0], targetId, templateId);
        setTimeout(() => {
            let $p = $('#FarmGodProgessbar'); 
            $p.data('current', $p.data('current') + 1); 
            UI.updateProgressBar($p, $p.data('current'), $p.data('max')); 
            farmBusy = false;
        }, 300);
    } else {
        farmBusy = false;
    }
  };
  return { init };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => { window.FarmGod.Main.init(); })();
