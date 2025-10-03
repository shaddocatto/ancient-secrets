// Add global error handler for debugging
window.addEventListener('error', function(e) {
    console.error('Global error caught:', e.error);
    const status = document.getElementById('saveStatus');
    if (status) {
        status.textContent = 'Error: ' + e.message;
        status.style.color = '#ff6b6b';
    }
});

let character = {
    characterName: '',
    playerName: '',
    heritage: '',
    concept: '',
    position: '',
    trouble: '',
    secret: '',
    skills: {
        strength: 0,
        warfare: 0,
        psyche: 0,
        endurance: 0,
        status: 0,
        intrigue: 0,
        hunting: 0,
        lore: 0
    },
    powers: [],
    extras: [],
    totalPoints: 60,
    usedPoints: 0,
    heritagePoints: 0
};

let extraIdCounter = 0;
let featureInstanceCounter = 0;
let gmPowerCosts = {};

function getCharNameEl() {
    return document.getElementById('characterNameInput')
        || document.getElementById('characterName')
        || document.querySelector('[name="characterName"]');
}
function getPlayerNameEl() {
    return document.getElementById('playerNameInput')
        || document.getElementById('playerName')
        || document.querySelector('[name="playerName"]');
}

// Heritage management
function updateHeritage() {
    try {
        const heritage = document.getElementById('heritage');
        if (!heritage) {
            console.error('Heritage element not found');
            return;
        }
        
        const heritageInfo = document.getElementById('heritageInfo');
        if (!heritageInfo) {
            console.error('Heritage info element not found');
            return;
        }
        
        character.heritage = heritage.value;
        
        let heritageDescription = '';
        let heritagePoints = 0;
        
        // Reset heritage-specific power states
        const patternAdept = document.getElementById('pattern-adept');
        const shapeshifting = document.getElementById('shapeshifting');
        
        if (patternAdept) patternAdept.disabled = false;
        if (shapeshifting) shapeshifting.disabled = false;
        
        switch(character.heritage) {
            case 'recognized-amber':
                heritageDescription = 'Free Pattern Adept power. Gains Court position, Blood Curse, and Slow Regeneration.';
                heritagePoints = 0;
                if (patternAdept) {
                    patternAdept.checked = true;
                    patternAdept.disabled = true;
                }
                break;
            case 'unrecognized-amber':
                heritageDescription = 'Gain 5 points. Has Blood Curse and Slow Regeneration. Work with GM for details.';
                heritagePoints = 5;
                break;
            case 'chaos':
                heritageDescription = 'Gain 2 points. Free Shapeshifting power.';
                heritagePoints = 2;
                if (shapeshifting) {
                    shapeshifting.checked = true;
                    shapeshifting.disabled = true;
                }
                break;
            case 'both':
                heritageDescription = 'Costs 3 points. Recognized status, Court position, Blood Curse, Slow Regeneration, Pattern, and Shapeshifting.';
                heritagePoints = -3;
                if (patternAdept) {
                    patternAdept.checked = true;
                    patternAdept.disabled = true;
                }
                if (shapeshifting) {
                    shapeshifting.checked = true;
                    shapeshifting.disabled = true;
                }
                break;
            case 'other':
                heritageDescription = 'Gain 6 points. Work with GM to create custom heritage.';
                heritagePoints = 6;
                break;
            default:
                heritageDescription = '';
                heritagePoints = 0;
                break;
        }
        
        character.heritagePoints = heritagePoints;
        
        if (heritageDescription) {
            heritageInfo.innerHTML = heritageDescription;
            heritageInfo.style.display = 'block';
        } else {
            heritageInfo.style.display = 'none';
        }
        
        updatePointsDisplay();
        updatePowers();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateHeritage:', error);
    }
}

// Skills management
function updateSkills() {
    try {
        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        
        skills.forEach(skill => {
            const element = document.getElementById(skill);
            if (!element) {
                console.warn(`Skill element not found: ${skill}`);
                return;
            }
            
            const value = parseInt(element.value) || 0;
            character.skills[skill] = value;
            
            const cost = Math.max(0, value);
            const costElement = document.getElementById(skill + 'Cost');
            if (costElement) {
                costElement.textContent = `Cost: ${cost} points`;
            }
        });
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateSkills:', error);
    }
}

// GM Power cost management
function updateGMPowerCost(powerId) {
    try {
        const costInput = document.getElementById(powerId + '-manual-cost');
        if (!costInput) {
            console.error(`GM cost input not found for: ${powerId}`);
            return;
        }
        
        const cost = parseInt(costInput.value) || 0;
        gmPowerCosts[powerId] = cost;
        
        const costSpan = document.getElementById(powerId + '-cost');
        if (costSpan) {
            costSpan.textContent = cost > 0 ? cost.toString() : 'GM';
        }
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateGMPowerCost:', error);
    }
}

// Powers management
function updatePowers() {
    try {
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        character.powers = [];
        
        powerElements.forEach(element => {
            if (element.checked) {
                let powerCost = parseInt(element.dataset.cost);
                
                if (element.dataset.gmCost === 'true' && gmPowerCosts[element.id]) {
                    powerCost = gmPowerCosts[element.id];
                }
                
                character.powers.push({
                    id: element.id,
                    cost: powerCost,
                    prereq: element.dataset.prereq,
                    credit: element.dataset.credit
                });
            }
        });
        
        powerElements.forEach(element => {
            const prereq = element.dataset.prereq;
            if (prereq && !element.disabled) {
                const prereqElement = document.getElementById(prereq);
                const prereqMet = prereqElement && prereqElement.checked;
                const parentItem = element.closest('.power-item');
                if (parentItem) {
                    parentItem.classList.toggle('disabled', !prereqMet);
                }
                if (!prereqMet && element.checked) {
                    element.checked = false;
                }
            }
        });
        
        updatePowerCosts();
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updatePowers:', error);
    }
}

function updatePowerCosts() {
    try {
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        
        powerElements.forEach(element => {
            const powerId = element.id;
            const baseCost = parseInt(element.dataset.cost);
            const costSpan = document.getElementById(powerId + '-cost');
            
            if (!costSpan) return;
            
            let finalCost = baseCost;
            let isFree = false;
            let isDiscounted = false;
            
            if (element.dataset.gmCost === 'true') {
                const manualCost = gmPowerCosts[powerId] || 0;
                finalCost = manualCost;
                costSpan.textContent = manualCost > 0 ? manualCost.toString() : 'GM';
                costSpan.className = 'power-cost gm';
                return;
            }
            
            if (isHeritageFreePower(powerId)) {
                finalCost = 0;
                isFree = true;
            } else {
                if (element.dataset.credit && element.checked) {
                    const credits = element.dataset.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            finalCost += parseInt(creditValue);
                            isDiscounted = true;
                        }
                    });
                }
            }
            
            costSpan.textContent = finalCost === 0 ? 'Free' : finalCost.toString();
            costSpan.className = 'power-cost';
            
            if (isFree) {
                costSpan.classList.add('free');
            } else if (isDiscounted) {
                costSpan.classList.add('discounted');
            }
        });
    } catch (error) {
        console.error('Error in updatePowerCosts:', error);
    }
}

function isHeritageFreePower(powerId) {
    const heritage = character.heritage;
    if (heritage === 'recognized-amber' && powerId === 'pattern-adept') return true;
    if (heritage === 'chaos' && powerId === 'shapeshifting') return true;
    if (heritage === 'both' && (powerId === 'pattern-adept' || powerId === 'shapeshifting')) return true;
    return false;
}

// Extras management
function addExtra() {
    try {
        const extraId = 'extra_' + (++extraIdCounter);
        const extra = {
            id: extraId,
            name: '',
            type: '',
            isSimple: true,
            simpleAspect: '',
            features: [],
            isEditing: true
        };
        
        character.extras.push(extra);
        renderExtra(extra);
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in addExtra:', error);
    }
}

function removeExtra(extraId) {
    try {
        character.extras = character.extras.filter(e => e.id !== extraId);
        const element = document.getElementById(extraId);
        if (element) element.remove();
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in removeExtra:', error);
    }
}

function renderExtra(extra) {
    try {
        const container = document.getElementById('extrasContainer');
        if (!container) {
            console.error('Extras container not found');
            return;
        }
        
        let extraDiv = document.getElementById(extra.id);
        
        if (!extraDiv) {
            extraDiv = document.createElement('div');
            extraDiv.id = extra.id;
            extraDiv.className = 'power-category';
            extraDiv.style.marginBottom = '20px';
            container.appendChild(extraDiv);
        }
        
        if (extra.isEditing) {
            extraDiv.innerHTML = renderExtraEditMode(extra);
        } else {
            extraDiv.innerHTML = renderExtraDisplayMode(extra);
        }
    } catch (error) {
        console.error('Error in renderExtra:', error);
    }
}

function renderExtraEditMode(extra) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">Extra: ${extra.name || 'Unnamed'}</h3>
            <div>
                <button type="button" class="export-btn" onclick="saveExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Save</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="${extra.id}_name" value="${extra.name}" placeholder="e.g., Loyal Steed, Ancestral Sword, Shadow Realm" onchange="updateExtraName('${extra.id}')">
        </div>
        
        <div class="form-group">
            <label>Type:</label>
            <select id="${extra.id}_type" onchange="updateExtraType('${extra.id}')">
                <option value="">Select Type...</option>
                <option value="ally" ${extra.type === 'ally' ? 'selected' : ''}>Ally (pets, servants, associates, contacts)</option>
                <option value="domain" ${extra.type === 'domain' ? 'selected' : ''}>Domain (shadow, location, land)</option>
                <option value="item" ${extra.type === 'item' ? 'selected' : ''}>Item (weapon, tool, device)</option>
                <option value="mastery" ${extra.type === 'mastery' ? 'selected' : ''}>Mastery (training, knowledge, natural ability)</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>
                <input type="radio" name="${extra.id}_simple" value="true" ${extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', true)">
                Simple (Name + Aspect + Invokes)
            </label>
            <label>
                <input type="radio" name="${extra.id}_simple" value="false" ${!extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', false)">
                Custom (Detailed Features)
            </label>
        </div>
        
        <div id="${extra.id}_simple_options" style="display: ${extra.isSimple ? 'block' : 'none'};">
            <div class="form-group">
                <label>Aspect:</label>
                <input type="text" id="${extra.id}_aspect" value="${extra.simpleAspect || ''}" placeholder="e.g., Swift as the Wind, Unbreakable Bond" onchange="updateExtraAspect('${extra.id}')">
            </div>
            <div class="heritage-info">
                <strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.
            </div>
        </div>
        
        <div id="${extra.id}_custom_options" style="display: ${extra.isSimple ? 'none' : 'block'};">
            ${renderCustomOptions(extra)}
        </div>
        
        <div class="skill-cost">
            <strong>Total Cost: ${calculateExtraCost(extra)} points</strong>
        </div>
    `;
}

function renderExtraDisplayMode(extra) {
    const extraName = extra.name || 'Unnamed Extra';
    const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
    const extraCost = calculateExtraCost(extra);
    const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
    
    let details = '';
    
    if (extra.isSimple && extra.simpleAspect) {
        details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">Aspect: ${extra.simpleAspect}</div>`;
    } else if (!extra.isSimple && extra.features.length > 0) {
        const featureGroups = {};
        extra.features.forEach(f => {
            if (!featureGroups[f.name]) featureGroups[f.name] = [];
            featureGroups[f.name].push(f);
        });
        
        const featureDetails = Object.entries(featureGroups).map(([name, instances]) => {
            if (instances.length === 1) {
                const instance = instances[0];
                let detail = name;
                if (instance.description) detail += `: ${instance.description}`;
                if (instance.skill) detail += `: +2 to ${instance.skill}`;
                if (instance.skillUsed && instance.skillReplaced) detail += `: Use ${instance.skillUsed} for ${instance.skillReplaced}`;
                return detail;
            } else {
                return `${name} (×${instances.length})`;
            }
        }).join('<br>');
        
        details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">${featureDetails}</div>`;
    }
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">${extraName}${extraType}${costText}</h3>
            <div>
                <button type="button" class="export-btn" onclick="editExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Edit</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        ${details}
    `;
}

function editExtra(extraId) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) {
            console.error(`Extra not found: ${extraId}`);
            return;
        }
        extra.isEditing = true;
        renderExtra(extra);
    } catch (error) {
        console.error('Error in editExtra:', error);
    }
}

function saveExtra(extraId) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) {
            console.error(`Extra not found: ${extraId}`);
            return;
        }
        extra.isEditing = false;
        renderExtra(extra);
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in saveExtra:', error);
    }
}

function getSimpleInvokes(type) {
    switch(type) {
        case 'domain': return 2;
        case 'ally':
        case 'item':
        case 'mastery':
        default: return 1;
    }
}

function renderCustomOptions(extra) {
    if (!extra.type) return '<p style="color: #cccccc; font-style: italic;">Select a type to see custom options.</p>';
    
    const features = getAvailableFeatures(extra.type);
    let html = '<h4 style="color: #EFBF04; margin-bottom: 10px;">Available Features:</h4>';
    
    features.forEach(feature => {
        const instances = extra.features.filter(f => f.name === feature.name);
        const hasInstances = instances.length > 0;
        const isRequired = feature.required && !extra.features.some(f => f.name === feature.required);
        const disabled = isRequired ? 'disabled' : '';
        const disabledClass = isRequired ? 'disabled' : '';
        
        html += `
            <div class="power-item ${disabledClass}">
                <label>
                    <input type="checkbox" ${hasInstances ? 'checked' : ''} ${disabled} 
                           onchange="toggleExtraFeature('${extra.id}', '${feature.name}', ${feature.cost}, '${feature.required || ''}')">
                    <span class="power-cost">${feature.cost === 0 ? 'Free' : feature.cost < 0 ? `+${Math.abs(feature.cost)}` : feature.cost}</span>
                    ${feature.name}
                </label>
                <div class="power-description">${feature.description}</div>
                
                ${hasInstances ? renderFeatureInstances(extra.id, feature.name, instances) : ''}
            </div>
        `;
    });
    
    return html;
}

function renderFeatureInstances(extraId, featureName, instances) {
    let html = '<div class="feature-instances" style="margin-top: 10px;">';
    
    instances.forEach((instance, index) => {
        html += `
            <div class="feature-instance">
                <div class="feature-instance-header">
                    <span class="feature-instance-title">${featureName} #${index + 1}</span>
                    <button type="button" class="remove-instance-btn" onclick="removeFeatureInstance('${extraId}', '${featureName}', ${index})">×</button>
                </div>
                ${renderFeatureInstanceContent(extraId, featureName, instance, index)}
            </div>
        `;
    });
    
    html += `<button type="button" class="add-instance-btn" onclick="addFeatureInstance('${extraId}', '${featureName}')">Add Another ${featureName}</button>`;
    html += '</div>';
    
    return html;
}

function renderFeatureInstanceContent(extraId, featureName, instance, index) {
    const skillOptions = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    const skillSelect = skillOptions.map(skill => 
        `<option value="${skill}" ${instance.skill === skill ? 'selected' : ''}>${skill.charAt(0).toUpperCase() + skill.slice(1)}</option>`
    ).join('');
    
    switch(featureName) {
        case 'Skilled':
            return `
                <div class="form-group">
                    <label>Skills to Modify:</label>
                    <div>
                        ${(instance.skillMods || []).map((mod, idx) => `
                            <div class="skill-selection" style="margin-bottom: 5px;">
                                <select onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'skill', this.value)">
                                    <option value="">Select Skill...</option>
                                    ${skillOptions.map(skill => `<option value="${skill}" ${mod.skill === skill ? 'selected' : ''}>${skill.charAt(0).toUpperCase() + skill.slice(1)}</option>`).join('')}
                                </select>
                                <input type="number" min="-3" max="12" value="${mod.value || 0}" 
                                       onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'value', this.value)" placeholder="Value">
                                <button type="button" class="remove-instance-btn" onclick="removeSkillMod('${extraId}', '${featureName}', ${index}, ${idx})">×</button>
                            </div>
                        `).join('')}
                        <button type="button" class="add-instance-btn" onclick="addSkillMod('${extraId}', '${featureName}', ${index})" style="font-size: 0.7em; padding: 3px 6px;">Add Skill</button>
                    </div>
                </div>
            `;
            
        case 'Flexible':
            return `
                <div class="form-group">
                    <label>Use 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillUsed', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        in place of 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillReplaced', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., researching ancient families" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
            
        case 'Focus':
            return `
                <div class="form-group">
                    <label>+2 to 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., fighting in your home domain" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
            
        case 'Technique':
            return `
                <div class="form-group">
                    <label>Power Ability:</label>
                    <input type="text" placeholder="e.g., Trump Defense from Trump Artist" value="${instance.ability || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'ability', this.value)" style="width: 100%;">
                </div>
            `;
            
        case 'Training':
            return `
                <div class="form-group">
                    <label>Skill to Improve:</label>
                    <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="width: 100%;">
                        <option value="">Select Skill...</option>
                        ${skillSelect}
                    </select>
                    <label style="margin-top: 10px;">Improvement Level (+1 per point):</label>
                    <input type="number" min="1" max="5" value="${instance.level || 1}" 
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'level', this.value)" style="width: 100%;">
                </div>
            `;
            
        case 'Talented':
        case 'Unusual':
        case 'Primal Born':
            return `
                <div class="form-group">
                    <label>Description:</label>
                    <textarea placeholder="Describe the custom ability..." 
                              onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                              style="width: 100%; height: 60px; resize: vertical;">${instance.description || ''}</textarea>
                    <label style="margin-top: 10px;">GM-determined Cost:</label>
                    <input type="number" placeholder="Points" value="${instance.manualCost || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'manualCost', this.value)" style="width: 100%;">
                </div>
            `;
            
        default:
            return `
                <div class="form-group">
                    <label>Notes:</label>
                    <input type="text" placeholder="Additional details..." value="${instance.description || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)" style="width: 100%;">
                </div>
            `;
    }
}

function updateFeatureData(extraId, featureName, instanceIndex, field, value) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const instances = extra.features.filter(f => f.name === featureName);
        const instance = instances[instanceIndex];
        
        if (instance) {
            instance[field] = field === 'level' || field === 'manualCost' ? parseInt(value) || 0 : value;
            updatePointsDisplay();
            saveCharacter();
        }
    } catch (error) {
        console.error('Error in updateFeatureData:', error);
    }
}

function addSkillMod(extraId, featureName, instanceIndex) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        const instances = extra.features.filter(f => f.name === featureName);
        const instance = instances[instanceIndex];
        
        if (!instance.skillMods) instance.skillMods = [];
        instance.skillMods.push({ skill: '', value: 0 });
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
        saveCharacter();
    } catch (error) {
        console.error('Error in addSkillMod:', error);
    }
}

function removeSkillMod(extraId, featureName, instanceIndex, skillIndex) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        const instances = extra.features.filter(f => f.name === featureName);
        const instance = instances[instanceIndex];
        
        instance.skillMods.splice(skillIndex, 1);
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
        saveCharacter();
    } catch (error) {
        console.error('Error in removeSkillMod:', error);
    }
}

function updateSkillMod(extraId, featureName, instanceIndex, skillIndex, field, value) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        const instances = extra.features.filter(f => f.name === featureName);
        const instance = instances[instanceIndex];
        
        if (!instance.skillMods) instance.skillMods = [];
        if (!instance.skillMods[skillIndex]) instance.skillMods[skillIndex] = {};
        
        instance.skillMods[skillIndex][field] = field === 'value' ? parseInt(value) : value;
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateSkillMod:', error);
    }
}

function addFeatureInstance(extraId, featureName) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const feature = getAvailableFeatures(extra.type).find(f => f.name === featureName);
        if (!feature) return;
        
        const newInstance = {
            name: featureName,
            cost: feature.cost,
            instanceIndex: featureInstanceCounter++
        };
        
        switch(featureName) {
            case 'Skilled':
                newInstance.skillMods = [];
                break;
            case 'Training':
                newInstance.skill = '';
                newInstance.level = 1;
                break;
            case 'Flexible':
                newInstance.skillUsed = '';
                newInstance.skillReplaced = '';
                newInstance.circumstance = '';
                break;
            case 'Focus':
                newInstance.skill = '';
                newInstance.circumstance = '';
                break;
            case 'Technique':
                newInstance.ability = '';
                break;
            case 'Talented':
            case 'Unusual':
            case 'Primal Born':
                newInstance.description = '';
                newInstance.manualCost = 0;
                break;
            default:
                newInstance.description = '';
                break;
        }
        
        extra.features.push(newInstance);
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in addFeatureInstance:', error);
    }
}

function removeFeatureInstance(extraId, featureName, instanceIndex) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const instances = extra.features.filter(f => f.name === featureName);
        
        if (instances.length > 0) {
            const indexToRemove = extra.features.findIndex(f => f.name === featureName && instances.indexOf(f) === instanceIndex);
            if (indexToRemove >= 0) {
                extra.features.splice(indexToRemove, 1);
            }
            
            const remainingInstances = extra.features.filter(f => f.name === featureName);
            if (remainingInstances.length === 0) {
                const customDiv = document.getElementById(extraId + '_custom_options');
                if (customDiv) {
                    const checkbox = customDiv.querySelector(`input[onchange*="${featureName}"]`);
                    if (checkbox) checkbox.checked = false;
                }
            }
            
            const customDiv = document.getElementById(extraId + '_custom_options');
            if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
            
            updatePointsDisplay();
            saveCharacter();
        }
    } catch (error) {
        console.error('Error in removeFeatureInstance:', error);
    }
}

function toggleExtraFeature(extraId, featureName, cost, required) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const instances = extra.features.filter(f => f.name === featureName);
        
        if (instances.length > 0) {
            extra.features = extra.features.filter(f => f.name !== featureName);
        } else {
            addFeatureInstance(extraId, featureName);
            return;
        }
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in toggleExtraFeature:', error);
    }
}

function getAvailableFeatures(type) {
    const features = {
        ally: [
            { name: 'Base Cost', cost: 0.5, required: '', description: 'REQUIRED FIRST. Ally starts with an Aspect, one Skill at Amber (0), another at Chaos (-1), and 2 mild stress boxes.' },
            { name: 'Organization', cost: 1, required: 'Base Cost', description: 'Has many members. Ability to affect things at scale. Start with one face (named member).' },
            { name: 'Aspect', cost: 0.5, required: 'Base Cost', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Bound', cost: 1, required: 'Base Cost', description: 'May use Ally\'s senses, Skills, or Powers (w/ concentration).' },
            { name: 'Resolute', cost: 0.25, required: 'Base Cost', description: 'Gives Ally +1 to psychic defense.' },
            { name: 'Skilled', cost: 0.5, required: 'Base Cost', description: 'Additional Amber and Chaos skill plus 3 points to buy Skills, Powers, etc.' },
            { name: 'Sturdy', cost: 0.25, required: 'Base Cost', description: 'Add one mild stress box. If bought thrice, may add moderate boxes.' },
            { name: 'Unusual', cost: 0, required: 'Base Cost', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: 'Base Cost', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        domain: [
            { name: 'Aspect', cost: 0.25, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Barrier', cost: 0.25, required: '', description: 'Each time purchased blocks one Power from Domain.' },
            { name: 'Control', cost: 0.25, required: '', description: 'Each time purchased gives +1 to control Domain.' },
            { name: 'Exceptional', cost: 0.5, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 0.5, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Security', cost: 0.25, required: '', description: 'Each purchase gives +1 to secure Domain.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        item: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        mastery: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Dominant', cost: 4, required: '', description: 'Increases the Scale of one Skill to Legendary. Only one Skill allowed.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Immortal', cost: 1, required: '', description: 'Will recover from most any damage over time.' },
            { name: 'Incandescent', cost: 1, required: '', description: 'Lose all Power initiations, immune to Unmaking.' },
            { name: 'Primal Born', cost: 0, required: '', description: 'Requires Incandescent and Immortal, activated Ancient Heritage (see GM for cost and effects).' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Talented', cost: 0, required: '', description: 'Design a unique skill with custom abilities (see GM for cost).' },
            { name: 'Technique', cost: 0.5, required: '', description: 'Add one ability from a Power. If full Power acquired later, this refunds back.' },
            { name: 'Training', cost: 1, required: '', description: '1 point per +1 to Skill. Improve Advanced Power or Unique Skill.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ]
    };
    
    return features[type] || [];
}

function updateExtraName(extraId) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const nameInput = document.getElementById(extraId + '_name');
        if (!nameInput) return;
        
        extra.name = nameInput.value;
        
        const header = document.querySelector(`#${extraId} h3`);
        if (header) header.textContent = `Extra: ${extra.name || 'Unnamed'}`;
        
        saveCharacter();
    } catch (error) {
        console.error('Error in updateExtraName:', error);
    }
}

function updateExtraType(extraId) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const typeSelect = document.getElementById(extraId + '_type');
        if (!typeSelect) return;
        
        extra.type = typeSelect.value;
        extra.features = [];
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        if (customDiv) customDiv.innerHTML = renderCustomOptions(extra);
        
        const simpleDiv = document.getElementById(extraId + '_simple_options');
        if (simpleDiv) {
            const heritageInfo = simpleDiv.querySelector('.heritage-info');
            if (heritageInfo) {
                heritageInfo.innerHTML = `<strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.`;
            }
        }
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateExtraType:', error);
    }
}

function updateExtraMode(extraId, isSimple) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        extra.isSimple = isSimple;
        
        const simpleDiv = document.getElementById(extraId + '_simple_options');
        const customDiv = document.getElementById(extraId + '_custom_options');
        
        if (simpleDiv) simpleDiv.style.display = isSimple ? 'block' : 'none';
        if (customDiv) customDiv.style.display = isSimple ? 'none' : 'block';
        
        updatePointsDisplay();
        saveCharacter();
    } catch (error) {
        console.error('Error in updateExtraMode:', error);
    }
}

function updateExtraAspect(extraId) {
    try {
        const extra = character.extras.find(e => e.id === extraId);
        if (!extra) return;
        
        const aspectInput = document.getElementById(extraId + '_aspect');
        if (!aspectInput) return;
        
        extra.simpleAspect = aspectInput.value;
        saveCharacter();
    } catch (error) {
        console.error('Error in updateExtraAspect:', error);
    }
}

function calculateExtraCost(extra) {
    if (!extra.type) return 0;
    
    if (extra.isSimple) {
        return 1;
    } else {
        return extra.features.reduce((total, feature) => {
            let featureCost = feature.cost;
            
            if (feature.name === 'Training' && feature.level) {
                featureCost = feature.level;
            } else if ((feature.name === 'Talented' || feature.name === 'Unusual' || feature.name === 'Primal Born') && feature.manualCost !== undefined) {
                featureCost = feature.manualCost;
            }
            
            return total + featureCost;
        }, 0);
    }
}

// Points calculation
function calculateUsedPoints() {
    try {
        let total = 0;

        // Skills
        Object.values(character.skills).forEach(value => {
            total += Math.max(0, value);
        });

        // Powers
        character.powers.forEach(power => {
            let powerCost = power.cost;
            if (isHeritageFreePower(power.id)) {
                powerCost = 0;
            } else if (power.credit) {
                const credits = power.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        powerCost += parseInt(creditValue);
                    }
                });
            }
            total += Math.max(0, powerCost);
        });

        // Extras
        character.extras.forEach(extra => {
            total += calculateExtraCost(extra);
        });

        // 👇 Here's the key line: subtract the signed heritagePoints
        total -= (character.heritagePoints || 0);

        return total;
    } catch (error) {
        console.error('Error in calculateUsedPoints:', error);
        return 0;
    }
}


function updatePointsDisplay() {
    try {
        character.usedPoints = calculateUsedPoints();
        const remaining = character.totalPoints - character.usedPoints;
        
        const pointsRemainingElement = document.getElementById('pointsRemaining');
        if (pointsRemainingElement) {
            pointsRemainingElement.textContent = remaining;
        }
        
        const statusDiv = document.getElementById('pointsStatus');
        if (statusDiv) {
            if (remaining < 0) {
                statusDiv.innerHTML = '<div class="points-warning">Over Budget!</div>';
                if (pointsRemainingElement) {
                    pointsRemainingElement.className = 'points-remaining points-warning';
                }
            } else if (remaining === 0) {
                statusDiv.innerHTML = '<div class="success">Perfect!</div>';
                if (pointsRemainingElement) {
                    pointsRemainingElement.className = 'points-remaining';
                }
            } else {
                statusDiv.innerHTML = '';
                if (pointsRemainingElement) {
                    pointsRemainingElement.className = 'points-remaining';
                }
            }
        }
        
        updateCharacterSummary();
    } catch (error) {
        console.error('Error in updatePointsDisplay:', error);
    }
}

function updateCharacterSummary() {
    try {
        const summaryDiv = document.getElementById('characterSummary');
        if (!summaryDiv) return;
        
        let summary = '';
        
        if (character.heritage) {
            const heritageDisplay = character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const heritagePointsDisplay = character.heritagePoints !== 0 ? ` (${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints} pts)` : '';
            summary += `<p><strong>Heritage:</strong> ${heritageDisplay}${heritagePointsDisplay}</p>`;
        }
        
        summary += '<h4>Skills</h4>';
        Object.entries(character.skills).forEach(([skill, value]) => {
            if (value !== 0) {
                const skillCost = Math.max(0, value);
                const costDisplay = skillCost > 0 ? ` (${skillCost} pts)` : '';
                summary += `<p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}:</strong> ${value >= 0 ? '+' : ''}${value}${costDisplay}</p>`;
            }
        });
        
        if (character.powers.length > 0) {
            summary += '<h4>Powers</h4>';
            let hasGMPowers = false;
            character.powers.forEach(power => {
                const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                if (['dominion', 'essence', 'song'].includes(power.id)) {
                    const manualCost = gmPowerCosts[power.id];
                    summary += `<p><strong>${powerName}</strong> (${manualCost || 'GM approval required'} pts)</p>`;
                    hasGMPowers = true;
                } else {
                    let displayCost = power.cost;
                    if (isHeritageFreePower(power.id)) {
                        displayCost = 'Free';
                    } else if (power.credit) {
                        let actualCost = power.cost;
                        const credits = power.credit.split(',');
                        credits.forEach(credit => {
                            const [powerName, creditValue] = credit.split(':');
                            const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                            if (hasPowerForCredit) {
                                actualCost += parseInt(creditValue);
                            }
                        });
                        displayCost = Math.max(0, actualCost);
                    }
                    summary += `<p><strong>${powerName}</strong> (${displayCost} pts)</p>`;
                }
            });
            
            if (hasGMPowers) {
                summary += '<p style="color: #EFBF04; font-style: italic;">Note: Ancient powers require GM approval and custom point costs.</p>';
            }
        }
        
        if (character.extras.length > 0) {
            summary += '<h4>Extras</h4>';
            character.extras.forEach(extra => {
                const extraName = extra.name || 'Unnamed Extra';
                const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
                const extraCost = calculateExtraCost(extra);
                const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
                
                summary += `<p><strong>${extraName}${extraType}</strong>${costText}</p>`;
                
                if (extra.isSimple && extra.simpleAspect) {
                    summary += `<p style="margin-left: 20px; font-style: italic;">Aspect: ${extra.simpleAspect}</p>`;
                } else if (!extra.isSimple && extra.features.length > 0) {
                    const featureList = extra.features.map(f => f.name).join(', ');
                    summary += `<p style="margin-left: 20px; font-style: italic;">Features: ${featureList}</p>`;
                }
            });
        }
        
        summary += `<h4>Point Allocation</h4>`;
        summary += `<p><strong>Total Available:</strong> ${character.totalPoints}</p>`;
        if (character.heritagePoints !== 0) {
            summary += `<p><strong>Heritage Adjustment:</strong> ${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints}</p>`;
        }
        summary += `<p><strong>Used:</strong> ${character.usedPoints}</p>`;
        summary += `<p><strong>Good Stuff Rating:</strong> ${character.totalPoints - character.usedPoints}</p>`;
        
        summaryDiv.innerHTML = summary;
    } catch (error) {
        console.error('Error in updateCharacterSummary:', error);
    }
}

// Save/Load functionality with improved error handling
function saveCharacter() {
    try {
        const conceptElement = document.getElementById('concept');
        const positionElement = document.getElementById('position');
        const troubleElement = document.getElementById('trouble');
        const secretElement = document.getElementById('secret');
        const heritageElement = document.getElementById('heritage');
        const charNameEl = getCharNameEl();
        const playerNameEl = getPlayerNameEl();

        
        const saveData = {
            ...character,
            characterName: charNameEl ? charNameEl.value : (character.characterName || ''),
            playerName: playerNameEl ? playerNameEl.value : (character.playerName || ''),
            concept: conceptElement ? conceptElement.value : '',
            position: positionElement ? positionElement.value : '',
            trouble: troubleElement ? troubleElement.value : '',
            secret: secretElement ? secretElement.value : '',
            gmPowerCosts: gmPowerCosts,
            formValues: {
                heritage: heritageElement ? heritageElement.value : '',
                skills: {},
                powers: {}
            },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter
        };

        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        skills.forEach(skill => {
            const element = document.getElementById(skill);
            if (element) {
                saveData.formValues.skills[skill] = element.value;
            }
        });

        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        powerElements.forEach(element => {
            saveData.formValues.powers[element.id] = element.checked;
        });

        console.log('Saving character data:', saveData);
        console.log('Extras in save:', saveData.extras.length);
        
        localStorage.setItem('amberCharacter', JSON.stringify(saveData));
        
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Saved ✓';
            saveStatus.style.color = '#4ecdc4';
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 2000);
        }
        
        console.log('Save successful');
    } catch (error) {
        console.error('Save failed:', error);
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Save failed!';
            saveStatus.style.color = '#ff6b6b';
        }
    }
}

function loadCharacter() {
    try {
        console.log('Loading character...');
        const saved = localStorage.getItem('amberCharacter');
        if (!saved) {
            console.log('No saved character found');
            return;
        }

        const saveData = JSON.parse(saved);
        console.log('Loaded character data:', saveData);
        console.log('Extras in loaded data:', saveData.extras ? saveData.extras.length : 0);
        
        if (saveData.concept) {
            const element = document.getElementById('concept');
            if (element) element.value = saveData.concept;
        }
        if (saveData.position) {
            const element = document.getElementById('position');
            if (element) element.value = saveData.position;
        }
        if (saveData.trouble) {
            const element = document.getElementById('trouble');
            if (element) element.value = saveData.trouble;
        }
        if (saveData.secret) {
            const element = document.getElementById('secret');
            if (element) element.value = saveData.secret;
        }

        if (saveData.characterName || saveData.playerName) {
            const charNameEl = getCharNameEl();
            const playerNameEl = getPlayerNameEl();
            if (charNameEl && saveData.characterName !== undefined) {
                charNameEl.value = saveData.characterName;
            }
            if (playerNameEl && saveData.playerName !== undefined) {
                playerNameEl.value = saveData.playerName;
            }
            character.characterName = saveData.characterName || '';
            character.playerName = saveData.playerName || '';
        }

        if (saveData.gmPowerCosts) {
            gmPowerCosts = saveData.gmPowerCosts;
            Object.entries(gmPowerCosts).forEach(([powerId, cost]) => {
                const input = document.getElementById(powerId + '-manual-cost');
                if (input) input.value = cost;
            });
        }

        if (saveData.formValues && saveData.formValues.heritage) {
            const element = document.getElementById('heritage');
            if (element) {
                element.value = saveData.formValues.heritage;
                updateHeritage();
            }
        }

        if (saveData.formValues && saveData.formValues.skills) {
            Object.entries(saveData.formValues.skills).forEach(([skill, value]) => {
                const element = document.getElementById(skill);
                if (element) {
                    element.value = value;
                }
            });
            updateSkills();
        }

        if (saveData.formValues && saveData.formValues.powers) {
            Object.entries(saveData.formValues.powers).forEach(([powerId, checked]) => {
                const element = document.getElementById(powerId);
                if (element) {
                    element.checked = checked;
                }
            });
            updatePowers();
        }

        if (saveData.extras) {
            character.extras = saveData.extras;
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;
            
            console.log('Restoring extras:', character.extras.length);
            
            const container = document.getElementById('extrasContainer');
            if (container) {
                container.innerHTML = '';
                
                character.extras.forEach(extra => {
                    console.log('Rendering extra:', extra.id, extra.name);
                    renderExtra(extra);
                });
            }
        }

        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Loaded previous save ✓';
            saveStatus.style.color = '#4ecdc4';
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);
        }
        
        console.log('Load successful');
    } catch (error) {
        console.error('Load failed:', error);
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Load failed! Check console.';
            saveStatus.style.color = '#ff6b6b';
        }
    }
}

function resetCharacter() {
    if (confirm('Are you sure you want to reset all character data? This cannot be undone.')) {
        localStorage.removeItem('amberCharacter');
        location.reload();
    }
}

function exportCharacter() {
    try {
        const exportData = {
            ...character,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            secret: document.getElementById('secret').value
        };
        
        let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
        output += `Character: ${exportData.characterName || ''}\n`;
        output += `Player: ${exportData.playerName || ''}\n\n`;
        output += `Heritage: ${exportData.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
        if (exportData.heritagePoints !== 0) {
            output += ` (${exportData.heritagePoints > 0 ? '+' : ''}${exportData.heritagePoints} pts)`;
        }
        output += `\n`;
        output += `Concept: ${exportData.concept}\n`;
        output += `Position: ${exportData.position}\n`;
        output += `Trouble: ${exportData.trouble}\n`;
        output += `Secret: ${exportData.secret}\n\n`;
        
        output += '=== SKILLS ===\n';
        Object.entries(exportData.skills).forEach(([skill, value]) => {
            const skillCost = Math.max(0, value);
            const costDisplay = skillCost > 0 ? ` (${skillCost} pts)` : '';
            output += `${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${value >= 0 ? '+' : ''}${value}${costDisplay}\n`;
        });
        
        if (exportData.powers.length > 0) {
            output += '\n=== POWERS ===\n';
            exportData.powers.forEach(power => {
                const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                if (['dominion', 'essence', 'song'].includes(power.id)) {
                    const manualCost = gmPowerCosts[power.id];
                    output += `${powerName} (${manualCost || 'GM approval required'} pts)\n`;
                } else {
                    let displayCost = power.cost;
                    if (isHeritageFreePower(power.id)) {
                        displayCost = 'Free';
                    } else if (power.credit) {
                        let actualCost = power.cost;
                        const credits = power.credit.split(',');
                        credits.forEach(credit => {
                            const [powerName, creditValue] = credit.split(':');
                            const hasPowerForCredit = exportData.powers.some(p => p.id === powerName);
                            if (hasPowerForCredit) {
                                actualCost += parseInt(creditValue);
                            }
                        });
                        displayCost = Math.max(0, actualCost);
                    }
                    output += `${powerName} (${displayCost} pts)\n`;
                }
            });
        }
        
        if (exportData.extras.length > 0) {
            output += '\n=== EXTRAS ===\n';
            exportData.extras.forEach(extra => {
                const extraName = extra.name || 'Unnamed Extra';
                const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
                const extraCost = calculateExtraCost(extra);
                const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
                
                output += `${extraName}${extraType}${costText}\n`;
                
                if (extra.isSimple && extra.simpleAspect) {
                    output += `  Aspect: ${extra.simpleAspect}\n`;
                } else if (!extra.isSimple && extra.features.length > 0) {
                    extra.features.forEach(feature => {
                        output += `  ${feature.name}`;
                        if (feature.description) output += `: ${feature.description}`;
                        if (feature.skill) output += `: +2 to ${feature.skill}`;
                        if (feature.skillUsed && feature.skillReplaced) output += `: Use ${feature.skillUsed} for ${feature.skillReplaced}`;
                        if (feature.ability) output += `: ${feature.ability}`;
                        if (feature.skillMods && feature.skillMods.length > 0) {
                            const skillList = feature.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                            output += ` - Skills: ${skillList}`;
                        }
                        output += '\n';
                    });
                }
            });
        }
        
        output += `\n=== POINT SUMMARY ===\n`;
        output += `Total Available: ${exportData.totalPoints}\n`;
        if (exportData.heritagePoints !== 0) {
            output += `Heritage Adjustment: ${exportData.heritagePoints > 0 ? '+' : ''}${exportData.heritagePoints}\n`;
        }
        output += `Used: ${exportData.usedPoints}\n`;
        output += `Good Stuff Rating: ${exportData.totalPoints - exportData.usedPoints}\n`;
        
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ancient-secrets-character.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
    }
}

function testLocalStorage() {
    console.log('Testing localStorage functionality...');
    
    try {
        const testData = { test: 'data', timestamp: Date.now() };
        localStorage.setItem('test_amber_save', JSON.stringify(testData));
        
        const loaded = JSON.parse(localStorage.getItem('test_amber_save'));
        console.log('Basic save/load test:', loaded.test === 'data' ? 'PASSED' : 'FAILED');
        
        saveCharacter();
        console.log('Character save test: PASSED');
        
        const characterData = localStorage.getItem('amberCharacter');
        if (characterData) {
            const parsed = JSON.parse(characterData);
            console.log('Character load test:', parsed ? 'PASSED' : 'FAILED');
            console.log('Extras in save data:', parsed.extras ? parsed.extras.length : 0);
        } else {
            console.log('Character load test: FAILED - No data found');
        }
        
        localStorage.removeItem('test_amber_save');
        
        alert('localStorage test completed. Check console for results.');
        
    } catch (error) {
        console.error('localStorage test failed:', error);
        alert('localStorage test failed: ' + error.message);
    }
}

// Initialize with comprehensive error handling
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('Initializing character builder...');
        
        loadCharacter();
        updatePointsDisplay();
        
        const textInputs = ['concept', 'position', 'trouble', 'secret'];
        textInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('input', saveCharacter);
                element.addEventListener('blur', saveCharacter);
            } else {
                console.warn(`Text input not found: ${inputId}`);
            }
        });
        
        const gmPowerIds = ['dominion', 'essence', 'song'];
        gmPowerIds.forEach(powerId => {
            const input = document.getElementById(powerId + '-manual-cost');
            if (input) {
                input.addEventListener('change', () => updateGMPowerCost(powerId));
            } else {
                console.warn(`GM power input not found: ${powerId}`);
            }
        });
        
        console.log('Initialization complete');
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize character builder. Check console for details.');
    }

});

    // ============================================
    // IMPORT/EXPORT FUNCTIONS FOR MANAGE CHARACTERS SECTION
    // Add these to the end of your script.js file
    // ============================================

    // Export character as JSON
    function exportCharacterJSON() {
        try {
            const exportData = {
                characterName: getCharNameEl()?.value || character.characterName || '',
                playerName: getPlayerNameEl()?.value || character.playerName || '',
                heritage: character.heritage,
                concept: document.getElementById('concept')?.value || '',
                position: document.getElementById('position')?.value || '',
                trouble: document.getElementById('trouble')?.value || '',
                secret: document.getElementById('secret')?.value || '',
                skills: character.skills,
                powers: character.powers,
                extras: character.extras,
                totalPoints: character.totalPoints,
                usedPoints: character.usedPoints,
                heritagePoints: character.heritagePoints,
                gmPowerCosts: gmPowerCosts,
                extraIdCounter: extraIdCounter,
                featureInstanceCounter: featureInstanceCounter
            };
            
            console.log('Exporting character:', exportData);
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Use character concept for filename, or default
            const characterName = (exportData.concept || 'character').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${characterName}_ancient_secrets.json`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showImportStatus('Character exported successfully!', 'success');
        } catch (error) {
            console.error('Export JSON failed:', error);
            showImportStatus('Export failed: ' + error.message, 'error');
        }
    }

    // Export character as text (already exists, but renamed for clarity)
    function exportCharacterText() {
        exportCharacter();
    }

    // Import character from JSON file
    function importCharacterJSON(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                console.log('Importing character:', importedData);
                
                // Validate the data has required fields
                if (!importedData.hasOwnProperty('heritage') || !importedData.hasOwnProperty('skills')) {
                    throw new Error('Invalid character file format');
                }
                
                // Clear current character
                character = {
                    heritage: '',
                    concept: '',
                    position: '',
                    trouble: '',
                    secret: '',
                    skills: {
                        strength: 0,
                        warfare: 0,
                        psyche: 0,
                        endurance: 0,
                        status: 0,
                        intrigue: 0,
                        hunting: 0,
                        lore: 0
                    },
                    powers: [],
                    extras: [],
                    totalPoints: 60,
                    usedPoints: 0,
                    heritagePoints: 0
                };

                // ---- Names (UI + memory)
                const charNameEl = getCharNameEl();
                const playerNameEl = getPlayerNameEl();

                if (importedData.characterName !== undefined) {
                    character.characterName = importedData.characterName || '';
                    if (charNameEl) charNameEl.value = character.characterName;
                }
                if (importedData.playerName !== undefined) {
                    character.playerName = importedData.playerName || '';
                    if (playerNameEl) playerNameEl.value = character.playerName;
                }
                
                // Import heritage
                if (importedData.heritage) {
                    character.heritage = importedData.heritage;
                    const heritageElement = document.getElementById('heritage');
                    if (heritageElement) {
                        heritageElement.value = importedData.heritage;
                        updateHeritage();
                    }
                }
                
                // Import aspects
                if (importedData.concept) {
                    const element = document.getElementById('concept');
                    if (element) element.value = importedData.concept;
                }
                if (importedData.position) {
                    const element = document.getElementById('position');
                    if (element) element.value = importedData.position;
                }
                if (importedData.trouble) {
                    const element = document.getElementById('trouble');
                    if (element) element.value = importedData.trouble;
                }
                if (importedData.secret) {
                    const element = document.getElementById('secret');
                    if (element) element.value = importedData.secret;
                }
                
                // Import skills
                if (importedData.skills) {
                    Object.entries(importedData.skills).forEach(([skill, value]) => {
                        character.skills[skill] = value;
                        const element = document.getElementById(skill);
                        if (element) {
                            element.value = value;
                        }
                    });
                    updateSkills();
                }
                
                // Import GM power costs
                if (importedData.gmPowerCosts) {
                    gmPowerCosts = importedData.gmPowerCosts;
                    Object.entries(gmPowerCosts).forEach(([powerId, cost]) => {
                        const input = document.getElementById(powerId + '-manual-cost');
                        if (input) input.value = cost;
                    });
                }
                
                // Import powers - first uncheck all
                const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
                powerElements.forEach(element => {
                    element.checked = false;
                });
                
                // Then check the imported powers
                if (importedData.powers && Array.isArray(importedData.powers)) {
                    importedData.powers.forEach(power => {
                        const element = document.getElementById(power.id);
                        if (element) {
                            element.checked = true;
                        }
                    });
                    updatePowers();
                }
                
                // Import extras
                if (importedData.extras && Array.isArray(importedData.extras)) {
                    // Clear existing extras
                    character.extras = [];
                    const container = document.getElementById('extrasContainer');
                    if (container) container.innerHTML = '';
                    
                    // Set counters
                    if (importedData.extraIdCounter) {
                        extraIdCounter = importedData.extraIdCounter;
                    }
                    if (importedData.featureInstanceCounter) {
                        featureInstanceCounter = importedData.featureInstanceCounter;
                    }
                    
                    // Import each extra
                    importedData.extras.forEach(extra => {
                        character.extras.push(extra);
                        renderExtra(extra);
                    });
                }
                
                // Update display
                updatePointsDisplay();
                saveCharacter();
                
                showImportStatus('Character imported successfully!', 'success');
                
                // Reset file input
                event.target.value = '';
                
            } catch (error) {
                console.error('Import failed:', error);
                showImportStatus('Import failed: ' + error.message, 'error');
                event.target.value = '';
            }
        };
        
        reader.onerror = function() {
            showImportStatus('Failed to read file', 'error');
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    // Show import/export status message
    function showImportStatus(message, type) {
        const statusElement = document.getElementById('importStatus');
        if (!statusElement) {
            console.log('Status:', message);
            return;
        }
        
        statusElement.textContent = message;
        statusElement.style.color = type === 'success' ? '#4ecdc4' : '#ff6b6b';
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    // New character (clear everything)
    function newCharacter() {
        if (!confirm('Create a new character? This will clear all current data.')) {
            return;
        }
        
        // ---- Register imported character for dropdowns / lists
        try {
            const listKey = 'ancientSecrets.characters';
            const list = JSON.parse(localStorage.getItem(listKey) || '[]');

            // Use a simple duplicate check by name+player
            const exists = list.some(c =>
                c.characterName === (character.characterName || '') &&
                c.playerName === (character.playerName || '')
            );

            if (!exists) {
                // store a minimal record; you can store full character if you prefer
                list.push({
                    characterName: character.characterName || '',
                    playerName: character.playerName || '',
                    // optional: keep a snapshot
                    snapshot: JSON.parse(JSON.stringify(character))
                });
                localStorage.setItem(listKey, JSON.stringify(list));
            }

            // If your UI has a function to rebuild the dropdown, call it:
            if (typeof window.populateCharacterDropdown === 'function') {
                window.populateCharacterDropdown();
            }
        } catch (e) {
            console.warn('Could not update character list for dropdown:', e);
        }

        try {
            // Reset character data
            character = {
                characterName: '',
                playerName: '',
                heritage: '',
                concept: '',
                position: '',
                trouble: '',
                secret: '',
                skills: {
                    strength: 0,
                    warfare: 0,
                    psyche: 0,
                    endurance: 0,
                    status: 0,
                    intrigue: 0,
                    hunting: 0,
                    lore: 0
                },
                powers: [],
                extras: [],
                totalPoints: 60,
                usedPoints: 0,
                heritagePoints: 0
            };
            
            extraIdCounter = 0;
            featureInstanceCounter = 0;
            gmPowerCosts = {};
            
            // Clear heritage
            const heritageElement = document.getElementById('heritage');
            if (heritageElement) {
                heritageElement.value = '';
                updateHeritage();
            }
            
            // Clear aspects
            ['concept', 'position', 'trouble', 'secret'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = '';
            });

            // Clear character and player names
            const charNameEl2 = getCharNameEl();
            const playerNameEl2 = getPlayerNameEl();
            if (charNameEl2) charNameEl2.value = '';
            if (playerNameEl2) playerNameEl2.value = '';
            character.characterName = '';
            character.playerName = '';
            
            // Clear skills
            ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'].forEach(skill => {
                const element = document.getElementById(skill);
                if (element) element.value = 0;
            });
            updateSkills();
            
            // Clear powers
            const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
            powerElements.forEach(element => {
                element.checked = false;
                element.disabled = false;
            });
            updatePowers();
            
            // Clear GM power costs
            ['dominion', 'essence', 'song'].forEach(powerId => {
                const input = document.getElementById(powerId + '-manual-cost');
                if (input) input.value = '';
            });
            
            // Clear extras
            const extrasContainer = document.getElementById('extrasContainer');
            if (extrasContainer) extrasContainer.innerHTML = '';
            
            // Update display
            updatePointsDisplay();
            saveCharacter();
            
            showImportStatus('New character created', 'success');
            
        } catch (error) {
            console.error('New character failed:', error);
            showImportStatus('Failed to create new character: ' + error.message, 'error');
        }
    }

    // Delete current character (clear storage and reset)
    function deleteCharacter() {
        if (!confirm('Delete this character permanently? This cannot be undone.')) {
            return;
        }
        
        try {
            localStorage.removeItem('amberCharacter');
            newCharacter();
            showImportStatus('Character deleted', 'success');
        } catch (error) {
            console.error('Delete failed:', error);
            showImportStatus('Failed to delete character: ' + error.message, 'error');
        }
    }

    // ============================================
    // UPDATE THE resetCharacter FUNCTION
    // Replace the existing resetCharacter function with this:
    // ============================================

    function resetCharacter() {
        deleteCharacter();
    }

    console.log('Import/Export functions loaded successfully');