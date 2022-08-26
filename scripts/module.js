import {importToActor} from './lib/actorLib.js'
import {importToJournal} from './lib/journalLib.js'
import {vttLog, vttError, getFolderPath} from './lib/moduleLib.js'

CONFIG.debug.hooks = false

Hooks.once('init', async function () {

});

Hooks.once('ready', async function () {

});

Hooks.on('renderJournalSheet', async (app, html, data) => {
    vttLog(`renderJournalSheet hooked`)
    const actionsTabButton = $('<a class="file-picker" data-tab="vttestofoundry-journal" data-journalid="' + data._id + '"> VTTES Import </a>');
    const closeButton = html.find('.close')
    actionsTabButton.insertBefore(closeButton)

    actionsTabButton.on('click', journalShowFilePicker)

})

Hooks.on('renderActorSheet5e', async (app, html, data) => {
    const actionsTabButton = $('<a class="file-picker" data-tab="vttestofoundry-actor" data-actorid="' + data.actor._id + '"> VTTES Import </a>');
    const closeButton = html.find('.close')
    actionsTabButton.insertBefore(closeButton)

    actionsTabButton.on('click', actorShowFilePicker)
});


function journalReadFile(control) {
    vttLog("Importing ...")

    var importer = control.find('.json-import')[0]

    var journal = game.journal.get(importer.dataset.journalid)
    var f = importer['files'][0]

    var fReader = new FileReader();
    fReader.readAsText(f);

    fReader.onload = function () {
        var content = JSON.parse(fReader.result)
        if (!schemaIsValid(content)) {
            return
        }
        importToJournal(content, journal);
    }
    fReader.onerror = function () {
        vttError(fReader.error)
    }
}

function actorReadFile(control) {
    vttLog("Importing ...")

    var importer = control.find('.json-import')[0]

    var compendiums = control.find('input[type=checkbox]:checked')
    var compName = compendiums.toArray().reduce((arr, curr) => {
        arr.push(curr.name)
        return arr
      }, [])


    var actor = game.actors.get(importer.dataset.actorid)
    var f = importer['files'][0]

    var fReader = new FileReader();
    fReader.readAsText(f);

    fReader.onload = function () {
        var content = JSON.parse(fReader.result)
        if (!schemaIsValid(content)) {
            return
        }
        importToActor(content, actor, compName)
    }
    fReader.onerror = function () {
        vttError(fReader.error)
    }
}

function schemaIsValid(content) {
    if (!content.schema_version || parseInt(content.schema_version) < 3) {
        vttError(`The given document is not on a supported schema. Expected : 3 or superior, actual : ${content.schema_version ?? 'not set'}`, true);
        return false
    }
    return true
}

function journalShowFilePicker(event) {
    var dialog = new Dialog({
        title: "Import VTTES File",
        content: "<div class='form-group'><label for='data'>Source Data</label><input type='file' class='json-import' name='data' data-journalid='" +
            event.currentTarget.dataset.journalid + "'></div>",
        buttons: {
            one: {
                icon: '<i class="fas fa-file-import"></i>',
                label: "Import file",
                callback: journalReadFile
            },
            two: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("QACT.Cancel"),
                callback: () => vttLog("Chose Cancel")
            }
        },
        default: "two",
        render: html => vttLog("Register interactivity in the rendered dialog"),
        close: html => vttLog("Cancel")
    })
    dialog.render(true)
}

async function actorShowFilePicker(event) {
    var compendiums = []

    for (const [key, value] of game.packs.entries()) {
        var cData = {
            name: key,
            metaName: value.metadata.label,
            metaEntity: value.metadata.entity
        }
        compendiums.push(cData)
      }

    var dialogContent = await renderTemplate(getFolderPath() + 'templates/file-picker.hbs', 
    {
        actorId: event.currentTarget.dataset.actorid,
        compendiums: compendiums
    })
    
    var dialog = new Dialog({
        title: "Import VTTES File",
        content: dialogContent,
        buttons: {
            one: {
                icon: '<i class="fas fa-file-import"></i>',
                label: "Import file",
                callback: actorReadFile
            },
            two: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("QACT.Cancel"),
                callback: () => vttLog("Chose Cancel")
            }
        },
        default: "two",
        render: html => vttLog("Register interactivity in the rendered dialog"),
        close: html => vttLog("Closing")
    })
    dialog.render(true)
}



