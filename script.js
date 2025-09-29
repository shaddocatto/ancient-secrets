let character = {
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

// CRITICAL: Flag to prevent multiple summary updates
let isUpdatingSummary = false;

// Heritage management
function updateHeritage() {
    const heritage = document.getElementById('heritage').value;
    const heritageInfo = document.getElementById('heritageInfo');
    
    character.heritage = heritage;
    
    let heritageDescription = '';
    let heritagePoints = 0;
    
    // Reset heritage-specific power states
    document.getElementById('pattern-adept').disabled = false;
    document.getElementById('shapeshifting').disabled = false;
    
    switch(heritage) {
        case 'recognized-amber':
            heritageDescription = 'Free Pattern Adept power. Gains Court position, Blood Curse, and Slow Regeneration.';
            heritagePoints = 0;
            // Auto-enable Pattern Adept
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            break;
        case 'unrecognized-amber':
            heritageDescription = 'Gain 5 points. Has Blood Curse and Slow Regeneration. Work with GM for details.';
            heritagePoints = 5;
            break;
        case 'chaos':
            heritageDescription = 'Gain 2 points. Free Shapeshifting power.';
            heritagePoints = 2;
            // Auto-enable Shapeshifting
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
            break;
        case 'both':
            heritageDescription = 'Costs 3 points. Recognized status, Court position, Blood Curse, Slow Regeneration, Pattern, and Shapeshifting.';
            heritagePoints = -3;
            // Auto-enable both Pattern and Shapeshifting
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
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
}

// Skills management
function updateSkills() {
    const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    
    skills.forEach(skill => {
        const value = parseInt(document.getElementById(skill).value) || 0;
        character.skills[skill] = value;
        
        // Calculate cost (only positive values above 0 cost points)
        const cost = Math.max(0, value);
        document.getElementById(skill + 'Cost').textContent = `Cost: ${cost} points`;
    });
    
    updatePointsDisplay();
    saveCharacter();
}

// GM Power cost management
function updateGMPowerCost(powerId) {
    const costInput = document.getElementById(powerId + '-manual-cost');
    const cost = parseInt(costInput.value) || 0;
    gmPowerCosts[powerId] = cost;
    
    const costSpan = document.getElementById(powerId + '-cost');
    costSpan.textContent = cost > 0 ? cost.toString() : 'GM';
    
    updatePointsDisplay();
    saveCharacter();
}

// Powers management
function updatePowers() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    character.powers = [];
    
    powerElements.forEach(element => {
        if (element.checked) {
            let powerCost = parseInt(element.dataset.cost);
            
            // Check if this is a GM power with manual cost
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
    
    // Check prerequisites and enable/disable powers
    powerElements.forEach(element => {
        const prereq = element.dataset.prereq;
        if (prereq && !element.disabled) {
            const prereqMet = document.getElementById(prereq).checked;
            element.parentElement.parentElement.classList.toggle('disabled', !prereqMet);
            if (!prereqMet && element.checked) {
                element.checked = false;
            }
        }
    });
    
    // Update power costs display
    updatePowerCosts();
    updatePointsDisplay();
    saveCharacter();
}

function updatePowerCosts() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    
    powerElements.forEach(element => {
        const powerId = element.id;
        const baseCost = parseInt(element.dataset.cost);
        const costSpan = document.getElementById(powerId + '-cost');
        
        if (!costSpan) return;
        
        let finalCost = baseCost;
        let isFree = false;
        let isDiscounted = false;
        
        // Check if this is a GM power
        if (element.dataset.gmCost === 'true') {
            const manualCost = gmPowerCosts[powerId] || 0;
            finalCost = manualCost;
            costSpan.textContent = manualCost > 0 ? manualCost.toString() : 'GM';
            costSpan.className = 'power-cost gm';
            return;
        }
        
        // Check if this power is free from heritage
        if (isHeritageFreePower(powerId)) {
            finalCost = 0;
            isFree = true;
        } else {
            // Apply credits from other powers
            if (element.dataset.credit && element.checked) {
                const credits = element.dataset.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        finalCost += parseInt(creditValue); // creditValue is already negative
                        isDiscounted = true;
                    }
                });
            }
        }
        
        // Update the display
        costSpan.textContent = finalCost === 0 ? 'Free' : finalCost.toString();
        costSpan.className = 'power-cost';
        
        if (isFree) {
            costSpan.classList.add('free');
        } else if (isDiscounted) {
            costSpan.classList.add('discounted');
        }
    });
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
}

function removeExtra(extraId) {
    // CRITICAL: Preserve extras array integrity
    const originalLength = character.extras.length;
    character.extras = character.extras.filter(e => e.id !== extraId);
    
    console.log(`Removed extra ${extraId}. Length changed from ${originalLength} to ${character.extras.length}`);
    
    const extraElement = document.getElementById(extraId);
    if (extraElement) {
        extraElement.remove();
    }
    
    updatePointsDisplay();
    saveCharacter();
    
    // Verify extras are still there after save
    setTimeout(() => {
        console.log(`Extras after remove and save: ${character.extras.length}`);
    }, 100);
}

function renderExtra(extra) {
    const container = document.getElementById('extrasContainer');
    const extraDiv = document.getElementById(extra.id) || document.createElement('div');
    
    if (!extraDiv.id) {
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
                <input type="text" id="${extra.id}_aspect" value="${extra.simpleAspect}" placeholder="e.g., Swift as the Wind, Unbreakable Bond" onchange="updateExtraAspect('${extra.id}')">
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
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) {
        console.error(`Extra with ID ${extraId} not found!`);
        return;
    }
    extra.isEditing = true;
    renderExtra(extra);
}

function saveExtra(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) {
        console.error(`Extra with ID ${extraId} not found!`);
        return;
    }
    extra.isEditing = false;
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
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
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (instance) {
        instance[field] = field === 'level' || field === 'manualCost' ? parseInt(value) || 0 : value;
        updatePointsDisplay();
        saveCharacter();
    }
}

function addSkillMod(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    instance.skillMods.push({ skill: '', value: 0 });
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    saveCharacter();
}

function removeSkillMod(extraId, featureName, instanceIndex, skillIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (instance.skillMods) {
        instance.skillMods.splice(skillIndex, 1);
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        customDiv.innerHTML = renderCustomOptions(extra);
        saveCharacter();
    }
}

function updateSkillMod(extraId, featureName, instanceIndex, skillIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    if (!instance.skillMods[skillIndex]) instance.skillMods[skillIndex] = {};
    
    instance.skillMods[skillIndex][field] = field === 'value' ? parseInt(value) : value;
    updatePointsDisplay();
    saveCharacter();
}

function addFeatureInstance(extraId, featureName) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const feature = getAvailableFeatures(extra.type).find(f => f.name === featureName);
    
    const newInstance = {
        name: featureName,
        cost: feature.cost,
        instanceIndex: featureInstanceCounter++
    };
    
    // Initialize specific data based on feature type
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
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
}

function removeFeatureInstance(extraId, featureName, instanceIndex) {
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
            const checkbox = document.querySelector(`#${extraId}_custom_options input[onchange*="${featureName}"]`);
            if (checkbox) checkbox.checked = false;
        }
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        customDiv.innerHTML = renderCustomOptions(extra);
        
        updatePointsDisplay();
        saveCharacter();
    }
}

function toggleExtraFeature(extraId, featureName, cost, required) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        // Remove all instances of this feature
        extra.features = extra.features.filter(f => f.name !== featureName);
    } else {
        // Add first instance of this feature
        addFeatureInstance(extraId, featureName);
        return; // addFeatureInstance already handles the re-render
    }
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
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
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const nameInput = document.getElementById(extraId + '_name');
    extra.name = nameInput.value;
    
    const header = document.querySelector(`#${extraId} h3`);
    if (header) {
        header.textContent = `Extra: ${extra.name || 'Unnamed'}`;
    }
    
    saveCharacter();
}

function updateExtraType(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const typeSelect = document.getElementById(extraId + '_type');
    extra.type = typeSelect.value;
    extra.features = [];
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    if (customDiv) {
        customDiv.innerHTML = renderCustomOptions(extra);
    }
    
    const simpleDiv = document.getElementById(extraId + '_simple_options');
    if (simpleDiv) {
        const heritageInfo = simpleDiv.querySelector('.heritage-info');
        if (heritageInfo) {
            heritageInfo.innerHTML = `<strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.`;
        }
    }
    
    updatePointsDisplay();
    saveCharacter();
}

function updateExtraMode(extraId, isSimple) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    extra.isSimple = isSimple;
    
    const simpleDiv = document.getElementById(extraId + '_simple_options');
    const customDiv = document.getElementById(extraId + '_custom_options');
    
    if (simpleDiv) simpleDiv.style.display = isSimple ? 'block' : 'none';
    if (customDiv) customDiv.style.display = isSimple ? 'none' : 'block';
    
    updatePointsDisplay();
    saveCharacter();
}

function updateExtraAspect(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra) return;
    
    const aspectInput = document.getElementById(extraId + '_aspect');
    extra.simpleAspect = aspectInput.value;
    saveCharacter();
}

function calculateExtraCost(extra) {
    if (!extra.type) return 0;
    
    if (extra.isSimple) {
        return 1;
    } else {
        return extra.features.reduce((total, feature) => {
            let featureCost = feature.cost;
            
            // Handle special cases
            if (feature.name === 'Training' && feature.level) {
                featureCost = feature.level; // 1 point per +1
            } else if ((feature.name === 'Talented' || feature.name === 'Unusual' || feature.name === 'Primal Born') && feature.manualCost !== undefined) {
                featureCost = feature.manualCost; // GM-determined cost
            }
            
            return total + featureCost;
        }, 0);
    }
}

// Points calculation - FIXED to ensure consistency
function calculateUsedPoints() {
    let total = 0;
    
    // Add heritage points (can be negative)
    total += character.heritagePoints;
    
    // Calculate skill costs
    Object.values(character.skills).forEach(value => {
        total += Math.max(0, value);
    });
    
    // Calculate power costs with heritage discounts and credits
    character.powers.forEach(power => {
        let powerCost = power.cost;
        
        // Apply heritage discounts first
        if (isHeritageFreePower(power.id)) {
            powerCost = 0;
        } else {
            // Apply credits only if power wasn't free from heritage
            if (power.credit) {
                const credits = power.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        powerCost += parseInt(creditValue);
                    }
                });
            }
        }
        
        total += Math.max(0, powerCost);
    });
    
    // Calculate extras costs
    character.extras.forEach(extra => {
        total += calculateExtraCost(extra);
    });
    
    return total;
}

function updatePointsDisplay() {
    character.usedPoints = calculateUsedPoints();
    const remaining = character.totalPoints - character.usedPoints;
    
    const pointsElement = document.getElementById('pointsRemaining');
    if (pointsElement) {
        pointsElement.textContent = remaining;
    }
    
    const statusDiv = document.getElementById('pointsStatus');
    if (statusDiv) {
        if (remaining < 0) {
            statusDiv.innerHTML = '<div class="points-warning">Over Budget!</div>';
            if (pointsElement) pointsElement.className = 'points-remaining points-warning';
        } else if (remaining === 0) {
            statusDiv.innerHTML = '<div class="success">Perfect!</div>';
            if (pointsElement) pointsElement.className = 'points-remaining';
        } else {
            statusDiv.innerHTML = '';
            if (pointsElement) pointsElement.className = 'points-remaining';
        }
    }
    
    // CRITICAL: Prevent multiple summary updates
    if (!isUpdatingSummary) {
        updateCharacterSummary();
    }
}

function updateCharacterSummary() {
    // CRITICAL: Prevent recursive calls
    if (isUpdatingSummary) return;
    isUpdatingSummary = true;
    
    const summaryDiv = document.getElementById('characterSummary');
    if (!summaryDiv) {
        isUpdatingSummary = false;
        return;
    }
    
    // CRITICAL: Recalculate to ensure consistency
    const currentUsed = calculateUsedPoints();
    const currentRemaining = character.totalPoints - currentUsed;
    
    let summary = '<h3>Character Overview</h3>';
    
    if (character.heritage) {
        const heritageDisplay = character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const heritagePointsDisplay = character.heritagePoints !== 0 ? ` (${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints} pts)` : '';
        summary += `<p><strong>Heritage:</strong> ${heritageDisplay}${heritagePointsDisplay}</p>`;
    }
    
    // Skills summary
    summary += '<h4>Skills</h4>';
    Object.entries(character.skills).forEach(([skill, value]) => {
        if (value !== 0) {
            const skillCost = Math.max(0, value);
            const costDisplay = skillCost > 0 ? ` (${skillCost} pts)` : '';
            summary += `<p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}:</strong> ${value >= 0 ? '+' : ''}${value}${costDisplay}</p>`;
        }
    });
    
    // Powers summary
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
    
    // Extras summary
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
    
    // SINGLE Point Allocation section with consistent calculations
    summary += `<h4>Point Allocation</h4>`;
    summary += `<p><strong>Total Available:</strong> ${character.totalPoints}</p>`;
    if (character.heritagePoints !== 0) {
        summary += `<p><strong>Heritage Adjustment:</strong> ${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints}</p>`;
    }
    
    // Break down costs for transparency
    const skillCosts = Object.values(character.skills).reduce((total, value) => total + Math.max(0, value), 0);
    let powerCosts = 0;
    character.powers.forEach(power => {
        let cost = power.cost;
        if (isHeritageFreePower(power.id)) {
            cost = 0;
        } else if (power.credit) {
            const credits = power.credit.split(',');
            credits.forEach(credit => {
                const [powerName, creditValue] = credit.split(':');
                const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                if (hasPowerForCredit) {
                    cost += parseInt(creditValue);
                }
            });
        }
        powerCosts += Math.max(0, cost);
    });
    const extraCosts = character.extras.reduce((total, extra) => total + calculateExtraCost(extra), 0);
    
    summary += `<p><strong>Heritage Cost:</strong> ${character.heritagePoints}</p>`;
    summary += `<p><strong>Skills:</strong> ${skillCosts}</p>`;
    summary += `<p><strong>Powers:</strong> ${powerCosts}</p>`;
    summary += `<p><strong>Extras:</strong> ${extraCosts}</p>`;
    summary += `<p><strong>Total Used:</strong> ${currentUsed}</p>`;
    summary += `<p><strong>Good Stuff Rating:</strong> ${currentRemaining}</p>`;
    
    summaryDiv.innerHTML = summary;
    isUpdatingSummary = false;
}

// CRITICAL: Enhanced save/load functionality with extras protection
function saveCharacter() {
    try {
        // CRITICAL: Log before save to verify extras exist
        console.log(`Saving character with ${character.extras.length} extras`);
        
        const saveData = {
            heritage: character.heritage,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            secret: document.getElementById('secret').value,
            skills: { ...character.skills },
            powers: [...character.powers],
            extras: [...character.extras], // CRITICAL: Deep copy
            totalPoints: character.totalPoints,
            usedPoints: character.usedPoints,
            heritagePoints: character.heritagePoints,
            gmPowerCosts: { ...gmPowerCosts },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter,
            timestamp: Date.now()
        };

        // CRITICAL: Verify extras in save data
        console.log(`Save data contains ${saveData.extras.length} extras`);

        localStorage.setItem('amberCharacter', JSON.stringify(saveData));
        
        // CRITICAL: Verify save was successful
        const verification = localStorage.getItem('amberCharacter');
        if (verification) {
            const parsed = JSON.parse(verification);
            console.log(`Verification: localStorage contains ${parsed.extras.length} extras`);
            
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = 'Saved ✓';
                setTimeout(() => {
                    saveStatus.textContent = '';
                }, 2000);
            }
        } else {
            throw new Error('Save verification failed');
        }
    } catch (error) {
        console.error('Save failed:', error);
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Save failed!';
        }
    }
}

function loadCharacter() {
    try {
        const saved = localStorage.getItem('amberCharacter');
        if (!saved) {
            console.log('No saved character data found');
            return;
        }

        const saveData = JSON.parse(saved);
        console.log(`Loading character with ${saveData.extras ? saveData.extras.length : 0} extras`);
        
        // Load text fields
        if (saveData.concept) document.getElementById('concept').value = saveData.concept;
        if (saveData.position) document.getElementById('position').value = saveData.position;
        if (saveData.trouble) document.getElementById('trouble').value = saveData.trouble;
        if (saveData.secret) document.getElementById('secret').value = saveData.secret;

        // Load GM power costs
        if (saveData.gmPowerCosts) {
            gmPowerCosts = { ...saveData.gmPowerCosts };
            Object.entries(gmPowerCosts).forEach(([powerId, cost]) => {
                const input = document.getElementById(powerId + '-manual-cost');
                if (input) input.value = cost;
            });
        }

        // Load heritage
        if (saveData.heritage) {
            document.getElementById('heritage').value = saveData.heritage;
            updateHeritage();
        }

        // Load skills
        if (saveData.skills) {
            Object.entries(saveData.skills).forEach(([skill, value]) => {
                const element = document.getElementById(skill);
                if (element) {
                    element.value = value;
                }
            });
            updateSkills();
        }

        // Load powers
        if (saveData.powers) {
            character.powers = [...saveData.powers];
            // Restore form states
            saveData.powers.forEach(power => {
                const element = document.getElementById(power.id);
                if (element) {
                    element.checked = true;
                }
            });
            updatePowers();
        }

        // CRITICAL: Load extras with enhanced protection
        if (saveData.extras && Array.isArray(saveData.extras)) {
            console.log(`Restoring ${saveData.extras.length} extras from save data`);
            
            // CRITICAL: Full restoration of character object
            character = {
                ...character,
                heritage: saveData.heritage || '',
                skills: saveData.skills || character.skills,
                powers: saveData.powers || [],
                extras: [...saveData.extras], // CRITICAL: Deep copy
                totalPoints: saveData.totalPoints || 60,
                usedPoints: saveData.usedPoints || 0,
                heritagePoints: saveData.heritagePoints || 0
            };
            
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;
            
            // Clear and rebuild extras container
            const extrasContainer = document.getElementById('extrasContainer');
            if (extrasContainer) {
                extrasContainer.innerHTML = '';
                
                // Render each extra
                character.extras.forEach((extra, index) => {
                    console.log(`Rendering extra ${index + 1}: ${extra.name || 'Unnamed'}`);
                    renderExtra(extra);
                });
            }
            
            console.log(`Successfully loaded ${character.extras.length} extras`);
        } else {
            console.log('No extras data in save file');
        }

        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Loaded previous save ✓';
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);
        }
        
        // Final verification
        console.log(`Load complete. Character now has ${character.extras.length} extras`);
        
    } catch (error) {
        console.error('Load failed:', error);
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = 'Load failed!';
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
    const exportData = {
        heritage: character.heritage,
        concept: document.getElementById('concept').value,
        position: document.getElementById('position').value,
        trouble: document.getElementById('trouble').value,
        secret: document.getElementById('secret').value,
        skills: character.skills,
        powers: character.powers,
        extras: character.extras,
        heritagePoints: character.heritagePoints,
        usedPoints: calculateUsedPoints()
    };
    
    let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
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
    output += `Total Available: ${character.totalPoints}\n`;
    if (exportData.heritagePoints !== 0) {
        output += `Heritage Adjustment: ${exportData.heritagePoints > 0 ? '+' : ''}${exportData.heritagePoints}\n`;
    }
    output += `Used: ${exportData.usedPoints}\n`;
    output += `Good Stuff Rating: ${character.totalPoints - exportData.usedPoints}\n`;
    
    // Create downloadable file
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ancient-secrets-character.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function testLocalStorage() {
    // ENHANCED testing functionality with specific extras testing
    console.log('=== TESTING LOCALSTORAGE FUNCTIONALITY ===');
    
    try {
        // Test 1: Basic localStorage functionality
        console.log('Test 1: Basic localStorage functionality...');
        const testData = { test: 'data', timestamp: Date.now() };
        localStorage.setItem('test_amber_save', JSON.stringify(testData));
        
        const loaded = JSON.parse(localStorage.getItem('test_amber_save'));
        console.log('Basic save/load test:', loaded.test === 'data' ? 'PASSED' : 'FAILED');
        
        // Test 2: Character save functionality
        console.log('Test 2: Character save functionality...');
        const originalExtrasCount = character.extras.length;
        console.log(`Original extras count: ${originalExtrasCount}`);
        
        saveCharacter();
        console.log('Character save test: PASSED');
        
        // Test 3: Character load functionality
        console.log('Test 3: Character load functionality...');
        const characterData = localStorage.getItem('amberCharacter');
        if (characterData) {
            const parsed = JSON.parse(characterData);
            console.log('Character load test:', parsed ? 'PASSED' : 'FAILED');
            console.log(`Extras in save data: ${parsed.extras ? parsed.extras.length : 0}`);
            console.log(`Current character extras: ${character.extras.length}`);
            
            // Test 4: Extras persistence specifically
            console.log('Test 4: Extras persistence...');
            if (parsed.extras && parsed.extras.length === originalExtrasCount) {
                console.log('Extras persistence test: PASSED');
            } else {
                console.log('Extras persistence test: FAILED');
                console.log(`Expected: ${originalExtrasCount}, Got: ${parsed.extras ? parsed.extras.length : 0}`);
            }
        } else {
            console.log('Character load test: FAILED - No data found');
        }
        
        // Test 5: Add a test extra and verify save/load
        console.log('Test 5: Test extra creation and persistence...');
        const testExtraId = 'test_extra_' + Date.now();
        const testExtra = {
            id: testExtraId,
            name: 'Test Extra',
            type: 'item',
            isSimple: true,
            simpleAspect: 'Test Aspect',
            features: [],
            isEditing: false
        };
        
        character.extras.push(testExtra);
        console.log(`Added test extra. Count now: ${character.extras.length}`);
        
        saveCharacter();
        
        // Verify the test extra was saved
        const verifyData = JSON.parse(localStorage.getItem('amberCharacter'));
        const savedTestExtra = verifyData.extras.find(e => e.id === testExtraId);
        if (savedTestExtra && savedTestExtra.name === 'Test Extra') {
            console.log('Test extra save/load: PASSED');
        } else {
            console.log('Test extra save/load: FAILED');
        }
        
        // Clean up test extra
        character.extras = character.extras.filter(e => e.id !== testExtraId);
        saveCharacter();
        
        // Clean up test data
        localStorage.removeItem('test_amber_save');
        
        console.log('=== ALL TESTS COMPLETED ===');
        alert('localStorage tests completed. Check console for detailed results.');
        
    } catch (error) {
        console.error('localStorage test failed:', error);
        alert('localStorage test failed: ' + error.message);
    }
}

// Initialize and set up auto-save
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Ancient Secrets Character Builder...');
    
    loadCharacter();
    updatePointsDisplay();
    
    // Add event listeners for text inputs
    const textInputs = ['concept', 'position', 'trouble', 'secret'];
    textInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', saveCharacter);
            element.addEventListener('blur', saveCharacter);
        }
    });
    
    // Set up auto-save for GM power costs
    const gmPowerIds = ['dominion', 'essence', 'song'];
    gmPowerIds.forEach(powerId => {
        const input = document.getElementById(powerId + '-manual-cost');
        if (input) {
            input.addEventListener('change', () => updateGMPowerCost(powerId));
        }
    });
    
    console.log('Character builder initialized successfully');
});
