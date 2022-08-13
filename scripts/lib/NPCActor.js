import {
    default as ActorImporter
} from "./ActorImporter.js"
import * as moduleLib from './moduleLib.js'

export default class NPCActorImport extends ActorImporter {

    constructor(actor) {
        super(actor)
    }

    async import(content, compendiums) {
        await super.import(content, compendiums)

        var isNPC = (this.getAttribCurrentInt("npc") == 1)
        if (!isNPC) {
            ui.notifications.error('Actor is in incorrect format (expected : NPC)')
        }

        var monsterFeatures = await game.packs.get('dnd5e.monsterfeatures')

        var spells = await this.getAndPrepareSpells()

        moduleLib.vttLog('Iterating on Features ...')

        var embedFeaturesQueue = []
        var {
            embedQueue: embedFeaturesQueue,
            creationQueue: creationFeaturesQueue
        } = await this.embedMonsterFeatures(monsterFeatures)
        this.setDarkvision(embedFeaturesQueue)

        var embedActionsQueue = await this.embedFromCompendiums(['npcaction', 'weapon'], 'npcaction', {
            transformAction: this.updateDamage,
            createAction: this.createNPCAction
        })

        var allItemsToCreate = [...embedFeaturesQueue, ...embedActionsQueue, ...spells];


        await this.actor.createEmbeddedDocuments("Item", allItemsToCreate);

        var abilities = this.getAbilities(content)

        var skills = this.getSkills(abilities)

        var typeInfos = this.getAttribCurrent(content, "npc_type")
        var spaceIndex = typeInfos.indexOf(' ')
        var comaIndex = typeInfos.indexOf(',')
        var alignment = typeInfos.substring(comaIndex + 1)
        var size = moduleLib.getSizeCode(typeInfos.substring(0, spaceIndex).toLowerCase())
        var type = typeInfos.substring(spaceIndex, comaIndex)
        var tokenContent = this.getTokenSetup()

        this.actor.update({
            name: content.character.name,
            img: content.character.avatar,
            data: {
                skills: skills,
                abilities: abilities,
                attributes: this.getNPCAttributes(),
                details: this.getNPCDetails(alignment, type),
                traits: {
                    size: size,
                    languages: {
                        custom: this.getAttribCurrent("npc_languages")
                    },
                    ci: {
                        custom: this.getAttribCurrent("npc_condition_immunities")
                    },
                    di: {
                        custom: this.getAttribCurrent("npc_immunities")
                    },
                    dr: {
                        custom: this.getAttribCurrent("npc_resistances")
                    },
                    dv: {
                        custom: this.getAttribCurrent("npc_vulnerabilities")
                    }
                }
            },
            token: tokenContent
        })



    }



    async embedMonsterFeatures(monsterFeatures) {
        return await this.embedFromRepeating([monsterFeatures], 'npctrait', this.updateDescription)
    }

    updateDescription(content, currObject) {
        currObject.data.description.value = currObject.data.description.value.replaceAll('{creature}', content.character.name)
    }

    updateDamage(content, currObject, currFeat) {
        currObject.data.description.value = currObject.data.description.value.replaceAll('{creature}', content.character.name)
        if (currFeat.attack_damage) {
            currObject.data.damage.parts = [
                [currFeat.attack_damage.current, currFeat.attack_damagetype.current]
            ]
            currObject.data.attackBonus = parseInt(currFeat.attack_tohit.current)
        }
    }


    getNPCDetails(alignment, type) {

        var cr = this.getAttribCurrent("npc_challenge")
        if (cr === '—') {
            cr = '0'
        }

        return {
            biography: {
                value: unescape(this.content.character.bio),
                public: ""
            },
            alignment: alignment,
            race: this.getAttribCurrent("race_display"),
            cr: parseFloat(eval(cr)),
            type: {
                value: type
            }
        };
    }

    updateItemAsWeapon() {
        return {
            name: "Bite",
            type: "weapon",
            img: "systems/dnd5e/icons/skills/red_29.jpg",
            data: {
                description: {
                    value: "",
                    chat: "",
                    unidentified: ""
                },
                source: "",
                quantity: 1,
                weight: 0,
                price: null,
                attunement: 0,
                equipped: true,
                rarity: "",
                identified: false,
                activation: {
                    type: "action",
                    cost: 1,
                    condition: ""
                },
                duration: {
                    value: null,
                    units: ""
                },
                target: {
                    value: null,
                    width: null,
                    units: "",
                    type: ""
                },
                range: {
                    value: 5,
                    long: 0,
                    units: "ft"
                },
                uses: {
                    value: 0,
                    max: 0,
                    per: null
                },
                consume: {
                    type: "",
                    target: null,
                    amount: null
                },
                ability: "str",
                actionType: "mwak",
                attackBonus: 0,
                chatFlavor: "",
                critical: null,
                damage: {
                    parts: [
                        ["2d10  + @mod", "piercing"]
                    ],
                    versatile: ""
                },
                formula: "",
                save: {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                },
                armor: {
                    value: 10
                },
                hp: {
                    value: 0,
                    max: 0,
                    dt: null,
                    conditions: ""
                },
                weaponType: "natural",
                properties: {},
                proficient: true
            },
            effects: {},
            folder: null,
            sort: 0,
            permission: {
                default: 0
            },
            flags: {}
        }
    }

    getNPCHp() {
        var hpAttrib = this.getAttrib("hp")
        return {
            value: hpAttrib.max,
            max: hpAttrib.max
        };
    }

    async createNPCAction(item, options) {
        console.log(item)
        console.log(options)

        var desc = await renderTemplate(moduleLib.getFolderPath() + 'templates/itemDescription.hbs', {
            properties: item.itemproperties ? item.itemproperties.current : '',
            content: item.itemcontent ? item.itemcontent.current : ''
        })

        var newItem = {
            name: item.name.current,
            type: 'feat',
            data: {
                description: {
                    value: desc
                },
                source: 'Imported by vttes to Foundry',
                quantity: item.itemcount ? item.itemcount.current : 1,
                weight: item.itemweight ? item.itemweight.current : 0,
                rarity: "common",
            }
        }

        if (item.attack_damage) {

            newItem.type = 'weapon'

            var damageParts = [
                [item.attack_damage.current, item.attack_damagetype.current],
                [item.attack_damage2 ? item.attack_damage2.current : '', item.attack_damagetype2 ? item.attack_damagetype2.current : ''],
            ]

            var range = {
                value: 0,
                long: null,
                units: 'ft'
            }

            if (item.attack_range) {
                moduleLib.getAttackRange(item.attack_range.current)
            }

            var aType = moduleLib.getAttackType(item.attack_type ? item.attack_type.current : 'none')

            if (!aType) {
                if (range.value == 5) {
                    aType = moduleLib.getAttackType('Melee')
                } else {
                    aType = moduleLib.getAttackType('Ranged')
                }
            }

            newItem.data = {
                description: {
                    value: desc,
                    chat: "",
                    unidentified: ""
                },
                source: moduleLib.SOURCE_MESSAGE,
                quantity: 1,
                weight: 0,
                price: null,
                attunement: 0,
                equipped: true,
                rarity: "",
                identified: false,
                activation: {
                    type: "action",
                    cost: 1,
                    condition: ""
                },
                duration: {
                    value: null,
                    units: ""
                },
                target: {
                    value: null,
                    width: null,
                    units: "",
                    type: ""
                },
                range: range,
                uses: {
                    value: 0,
                    max: 0,
                    per: null
                },
                consume: {
                    type: "",
                    target: null,
                    amount: null
                },
                ability: "default",
                actionType: aType,
                attackBonus: item.attack_tohit.current,
                chatFlavor: "",
                critical: null,
                damage: {
                    parts: damageParts,
                    versatile: ''
                },
                formula: "",
                save: {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                },
                armor: {
                    value: 10
                },
                hp: {
                    value: 0,
                    max: 0,
                    dt: null,
                    conditions: ""
                },
                weaponType: "natural",
                properties: {},
                proficient: false
            }



            // newItem.data.actionType = moduleLib.getAttackTypeFromWeaponType(item.attack_type ? item.attack_type.current : "Melee")
        }

        return newItem
    }

    getNPCAttributes(darkvision) {
        var speed = 0

        var speedInfos = this.getAttribCurrent("speed")
        var regexOutput = this.numberRegex.exec(speedInfos);
        if (regexOutput && regexOutput.length > 0) {
            speed = parseInt(regexOutput[0])
        }


        return {
            ac: {
                value: this.getAttribCurrentInt("ac")
            },
            hp: this.getNPCHp(),
            init: {
                mod: this.getAttribCurrentInt("initiative_bonus"),
            },
            movement: {
                burrow: 0,
                climb: 0,
                fly: 0,
                swim: 0,
                walk: speed,
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
            spellLevel: this.getAttribCurrentInt('caster_level'),
            spelldc: this.getAttribCurrentInt('npc_spelldc'),
            encumbrance: {
                value: 0,
                max: 120,
                pct: 0,
                encumbered: false
            },
        }
    }
}