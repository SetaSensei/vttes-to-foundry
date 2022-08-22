import {
    DND5E
} from "../../../../systems/dnd5e/module/config.js";
import ActorImporter from "./ActorImporter.js";
import * as moduleLib from './moduleLib.js'


export default class PCActorImport extends ActorImporter {
    constructor(actor) {
        super(actor)
    }

    async import(content, compendiums) {
        await super.import(content, compendiums)

        var abilities = this.getAbilities();
        var traits = await this.embedFromCompendiums(['feat'], ['traits'], {
            createAction: this.createFeat
        })
        this.setDarkvision(traits);

        var inventory = await this.embedFromCompendiums(['equipment'], ['inventory'], {
            keyName: 'itemname',
            createAction: this.createItem,
            features: this.repeatingFeatures,
            transformAction: this.applyItemTranformation,
            correspondances: [
                { key: 'wooden shield', value: 'shield' }
            ]
        })

        var spellKeys = this.getSpellsKeys();

        var spells = await this.embedFromCompendiums(['spell'], spellKeys, {
            keyName: 'spellname',
            createAction: this.createSpell,
            features: this.repeatingFeatures,
            transformAction: this.applySpellTranformation
        })

        await this.setClasses();

        var size = moduleLib.getSizeCode(this.getAttribCurrent("size"))

        await this.updatePCActorSheet(this.darkvision, size, abilities);

        this.applyProficiencies(inventory);

        var allItemsToCreate = [...inventory, ...traits, ...spells];
        await this.actor.createEmbeddedDocuments("Item", allItemsToCreate);


        if (this.content.character.defaulttoken && this.content.character.defaulttoken != '') {
            var tokenInfos = JSON.parse(this.content.character.defaulttoken);
            await this.updateToken(tokenInfos, this.darkvision);
        } else {
            await this.updateToken({
                name: this.actor.name,
                imgsrc: this.actor.img
            }, this.darkvision);
        }

        await this.actor.longRest({ dialog: false, chat: false })
    }

    getSpellsKeys() {
        var output = ['spell-cantrip']

        for (var i = 1; i < 10; i++) {
            output.push(`spell-${i}`)
        }

        return output
    }

    async updateToken(tokenInfos, darkvision) {
        var actorToken = this.actor.data.token;

        if (tokenInfos.sides && tokenInfos.sides != '') {
            var allSides = tokenInfos.sides.split('|')

            var macrosCompendium = game.packs.get(`world.${moduleLib.MACRO_COMP_NAME}`)

            var script = `let d = new Dialog({
                title: "Sides for ${tokenInfos.name}",
                content: "<p>Choose image for the selected token</p>",
                buttons: {`

            var idx = 0
            allSides.forEach(element => {
                var url = decodeURIComponent(element)
                script += `${idx++}: {`
                script += `    icon: "<img src='${url}' style:'width:60px;'/>",`
                script += `    callback: () => updateToken('${url}')`
                script += '  },'
            });

            script += `  }
        });
       
       d.render(true);
       
       function updateToken(imgUrl) {
         let tokens = canvas.tokens.controlled
       
         if (tokens.length > 0) {
           update(tokens[0], imgUrl)
         } else {
           ui.notifications.warn("No Tokens were selected");
         }
       }
       
       function update(token, url) {
         updates = [{
           _id: token.id,
           img: url
         }];
         canvas.scene.updateEmbeddedDocuments("Token", updates);
       }`

            var macroName = `${tokenInfos.name} Token Change`

            var existingMacro = macrosCompendium.index.getName(macroName)
            if (existingMacro != null) {
                moduleLib.vttWarn(`Macro for actor ${tokenInfos.name} already existing, deleting ...`, true)
                await macrosCompendium.delete(existingMacro._id)
            }

            var tokenMacro = new Macro({
                name: macroName,
                img: tokenInfos.imgsrc,
                type: 'script',
                command: script
            })
            macrosCompendium.importDocument(tokenMacro)

            moduleLib.vttLog(`Actor has rollable token. Make sure you also assign macro to the player`, true)
        }

        await actorToken.update({
            name: tokenInfos.name,
            vision: true,
            dimSight: tokenInfos.night_vision_distance ?? darkvision,
            img: tokenInfos.imgsrc,
            displayName: tokenInfos.showname ? CONST.TOKEN_DISPLAY_MODES.ALWAYS : CONST.TOKEN_DISPLAY_MODES.NONE
        });
    }

    applyItemTranformation(content, objectToTransform, linkedFeature) {
        if (objectToTransform.type == 'equipment' || objectToTransform.type == 'weapon') {
            objectToTransform.data.equipped = linkedFeature['equipped'] ? linkedFeature['equipped'].current == 1 : true
        }
        objectToTransform.data.quantity = linkedFeature.itemcount ? linkedFeature.itemcount.current : 1
    }

    applyProficiencies(inventory) {
        for (let idx = 0; idx < inventory.length; idx++) {
            const item = inventory[idx];
            if (item.type === 'weapon') {
                console.log(`${item.name} - ${item.data.weaponType}`);
                const wType = DND5E.weaponProficienciesMap[item.data.weaponType];

                if (this.actor.data.data.traits.weaponProf.value.includes(wType) || this.actor.data.data.traits.weaponProf.value.includes(item.name)) {
                    item.data.proficient = true;
                }
            }
        }
    }

    async setClasses() {
        await this.setActorMainClass();
        await this.setMultiClass();
    }

    async setMultiClass() {
        var multiClasses = this.getAttribsStartsWith('multiclass');
        if (multiClasses.length > 0) {
            var activeMultClasses = multiClasses.filter(sc => sc.name.endsWith('_flag') && sc.current === '1');

            for (let index = 0; index < activeMultClasses.length; index++) {
                const multClass = activeMultClasses[index];
                var key = multClass.name.substring(0, multClass.name.indexOf('_'));

                var level = this.getAttribCurrentInt(key + '_lvl');
                var multClassName = this.getAttribCurrent(key);
                var multClassSubName = this.getAttribCurrent(key + '_subclass');

                await this.setClass(multClassName, multClassSubName, level);
            }
        }
    }

    getPCDetails() {
        return {
            biography: {
                value: unescape(this.content.character.bio),
                public: ""
            },
            alignment: this.getAttribCurrent("alignment"),
            race: this.getAttribCurrent("race_display"),
            background: this.getAttribCurrent("background"),
            xp: {
                value: this.getAttribCurrentInt("experience")
            },
            appearance: "",
            trait: this.getAttribCurrent("personality_traits"),
            ideal: this.getAttribCurrent("ideals"),
            bond: this.getAttribCurrent("bonds"),
            flaw: this.getAttribCurrent("flaws"),
            age: this.getAttribCurrent("age"),
            height: this.getAttribCurrent("height"),
            weight: this.getAttribCurrent("weight"),
            eyes: this.getAttribCurrent("eyes"),
            skin: this.getAttribCurrent("skin"),
            hair: this.getAttribCurrent("hair"),
            level: this.getAttribCurrentInt("level")
        };
    }

    async updatePCActorSheet(darkvision, size, abilities) {
        var details = this.getPCDetails()

        var skills = this.getSkills(abilities)
        var tools = this.getToolProficiencies()

        var proficiencies = this.getGlobalProficiencies()
        var tokenContent = this.getTokenSetup()

        var languageProficiencies = this.getLanguagesProficiencies(proficiencies)
        var weaponProficiencies = this.getWeaponsProficiencies(proficiencies)
        var armorProficiencies = this.getArmorsProficiencies(proficiencies)

        await this.actor.update({
            name: this.content.character.name,
            img: this.content.character.avatar,
            data: {
                details: details,
                abilities: abilities,
                attributes: {
                    ac: {
                        value: this.getAttribCurrentInt("ac")
                    },
                    hp: this.getHp(),
                    init: {
                        value: this.getAttribCurrentInt("initmod"),
                    },
                    movement: {
                        burrow: 0,
                        climb: 0,
                        fly: 0,
                        swim: 0,
                        walk: this.getAttribCurrentInt("speed"),
                        units: "ft",
                        hover: false
                    },
                    senses: {
                        darkvision: darkvision,
                        blindsight: 0,
                        tremorsense: 0,
                        truesight: 0,
                        units: "ft",
                        special: ""
                    },
                    spellcasting: this.getSpellcastingAbility(),
                    exhaustion: 0,
                    hd: 0,
                    prof: 1,
                    encumbrance: {
                        value: 0,
                        max: 120,
                        pct: 0,
                        encumbered: false
                    },
                },
                currency: {
                    pp: this.getAttribCurrentInt('pp'),
                    gp: this.getAttribCurrentInt('gp'),
                    ep: this.getAttribCurrentInt('ep'),
                    sp: this.getAttribCurrentInt('sp'),
                    cp: this.getAttribCurrentInt('cp')
                },
                skills: skills,
                traits: {
                    size: size,
                    di: {
                        value: [],
                        custom: ""
                    },
                    dr: {
                        value: [],
                        custom: ""
                    },
                    dv: {
                        value: [],
                        custom: ""
                    },
                    ci: {
                        value: [],
                        custom: ""
                    },
                    languages: {
                        value: languageProficiencies.valid,
                        custom: languageProficiencies.customList
                    },
                    weaponProf: {
                        value: weaponProficiencies.valid,
                        custom: weaponProficiencies.customList
                    },
                    armorProf: {
                        value: armorProficiencies.valid,
                        custom: armorProficiencies.customList
                    },
                    toolProf: {
                        value: tools,
                        custom: tools.join(';')
                    }
                }
            },
            token: tokenContent
        });
    }

    getToolProficiencies() {
        return this.getAttributesBySuffix("_toolname").reduce((acc, curr) => {
            acc.push(moduleLib.capitalizeFirstLetterOfEveryWord(curr.current));
            return acc;
        }, []);
    }
}


