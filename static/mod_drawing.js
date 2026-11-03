/* ============================================================================
   static/mod_drawing.js (v101 - Step 1)
   Fixed Drawing Arrows from Already Highlighted Squares (pointer-events: none on SVG children)
   ============================================================================ */

var customAnnotations = [];
var redoAnnotations = [];
var currentDrawColor = 'rgba(255, 170, 0, 0.75)';
var dragStartSq = null;
var dragCurrentSq = null;
var isDraggingAnnotation = false;
var lastTouchTimestamp = 0;

window.toggleDrawMode = function() {
    drawModeEnabled = !drawModeEnabled;
    let btn = document.getElementById('btn-draw-mode');
    let pal = document.getElementById('draw-palette-bar');
    let svg = document.getElementById('custom-draw-overlay');

    if (drawModeEnabled) {
        if (btn) { btn.style.background = '#e63946'; btn.style.borderColor = '#e63946'; btn.style.color = '#fff'; btn.innerText = 'Done'; }
        if (pal) pal.style.display = 'flex';
        if (svg) svg.classList.add('drawing-active');
        $('#status').text("Draw Mode ON: Drag from any square for Arrow / L-Arrow, Tap for Square");
    } else {
        if (btn) { btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; btn.innerText = 'Draw'; }
        if (pal) pal.style.display = 'none';
        if (svg) svg.classList.remove('drawing-active');
        updateStatus();
    }
};

window.setDrawColor = function(colorStr, dotEl) {
    currentDrawColor = colorStr;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active-dot'));
    if (dotEl) dotEl.classList.add('active-dot');
};

window.undoDrawAnnotation = function() {
    if (customAnnotations.length > 0) {
        redoAnnotations.push(customAnnotations.pop());
        renderCustomAnnotations();
    }
};

window.redoDrawAnnotation = function() {
    if (redoAnnotations.length > 0) {
        customAnnotations.push(redoAnnotations.pop());
        renderCustomAnnotations();
    }
};

window.clearCustomAnnotations = function() {
    if (customAnnotations.length === 0 && !dragStartSq) return;
    customAnnotations = [];
    redoAnnotations = [];
    dragStartSq = null;
    dragCurrentSq = null;
    renderCustomAnnotations();
};

function clientPointToSquare(clientX, clientY) {
    let boardEl = document.getElementById('board');
    if (!boardEl) return null;
    let rect = boardEl.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    let col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
    let row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let boardRow = (currentBoardOrientation === 'w') ? row : (7 - row);
    let boardCol = (currentBoardOrientation === 'w') ? col : (7 - col);
    return files[boardCol] + (8 - boardRow);
}

function isKnightJump(fromSq, toSq) {
    if (!fromSq || !toSq || fromSq.length < 2 || toSq.length < 2) return false;
    let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let df = Math.abs(files.indexOf(fromSq[0]) - files.indexOf(toSq[0]));
    let dr = Math.abs(parseInt(fromSq[1]) - parseInt(toSq[1]));
    return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

function buildArrowSvgMarkup(fromSq, toSq, color, isPreview) {
    let p1 = sqToSvgCoords(fromSq);
    let p2 = sqToSvgCoords(toSq);
    let opacity = isPreview ? '0.62' : '0.78';

    if (fromSq === toSq) {
        let sqX = p1.x - 20;
        let sqY = p1.y - 20;
        return `<g style="pointer-events:none;" opacity="${opacity}">
            <rect x="${sqX}" y="${sqY}" width="40" height="40" fill="${color}" opacity="0.45" style="pointer-events:none;" />
            <rect x="${sqX + 1.5}" y="${sqY + 1.5}" width="37" height="37" fill="none" stroke="${color}" stroke-width="3.2" style="pointer-events:none;" />
        </g>`;
    }

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;

    if (isKnightJump(fromSq, toSq)) {
        let cornerX = (Math.abs(dx) > Math.abs(dy)) ? p2.x : p1.x;
        let cornerY = (Math.abs(dx) > Math.abs(dy)) ? p1.y : p2.y;
        let legDx = p2.x - cornerX;
        let legDy = p2.y - cornerY;
        let legLen = Math.hypot(legDx, legDy) || 1;
        let ux = legDx / legLen;
        let uy = legDy / legLen;

        let endX = p2.x - ux * 13;
        let endY = p2.y - uy * 13;
        let tipX = p2.x - ux * 1;
        let tipY = p2.y - uy * 1;
        let px = -uy, py = ux;
        let b1x = endX + px * 10.5, b1y = endY + py * 10.5;
        let b2x = endX - px * 10.5, b2y = endY - py * 10.5;

        return `<g style="pointer-events:none;" opacity="${opacity}">
            <polyline points="${p1.x},${p1.y} ${cornerX},${cornerY} ${endX},${endY}" fill="none" stroke="${color}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;" />
            <polygon points="${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}" fill="${color}" style="pointer-events:none;" />
        </g>`;
    }

    let len = Math.hypot(dx, dy) || 1;
    let ux = dx / len;
    let uy = dy / len;
    let startX = p1.x + ux * 5;
    let startY = p1.y + uy * 5;
    let endX = p2.x - ux * 13;
    let endY = p2.y - uy * 13;
    let tipX = p2.x - ux * 1;
    let tipY = p2.y - uy * 1;
    let px = -uy, py = ux;
    let b1x = endX + px * 10.5, b1y = endY + py * 10.5;
    let b2x = endX - px * 10.5, b2y = endY - py * 10.5;

    return `<g style="pointer-events:none;" opacity="${opacity}">
        <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="8.5" stroke-linecap="round" style="pointer-events:none;" />
        <polygon points="${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}" fill="${color}" style="pointer-events:none;" />
    </g>`;
}

window.renderCustomAnnotations = function() {
    let svg = document.getElementById('custom-draw-overlay');
    if (!svg) return;
    let html = '';
    // Render squares first, then arrows on top so arrows starting from a highlighted square are clearly visible
    customAnnotations.filter(a => a.from === a.to).forEach(item => {
        html += buildArrowSvgMarkup(item.from, item.to, item.color, false);
    });
    customAnnotations.filter(a => a.from !== a.to).forEach(item => {
        html += buildArrowSvgMarkup(item.from, item.to, item.color, false);
    });
    if (isDraggingAnnotation && dragStartSq && dragCurrentSq && dragStartSq !== dragCurrentSq) {
        html += buildArrowSvgMarkup(dragStartSq, dragCurrentSq, currentDrawColor, true);
    }
    svg.innerHTML = html;
};

window.drawMoveArrow = function(fromSq, toSq, color = 'rgba(129, 182, 76, 0.88)') {
    let svg = document.getElementById('arrow-overlay');
    if (!svg) return;
    svg.innerHTML = buildArrowSvgMarkup(fromSq, toSq, color, false);
};

function commitAnnotation(fromSq, toSq) {
    if (!fromSq || !toSq) return;
    let type = (fromSq === toSq) ? 'square' : 'arrow';
    let existingIdx = customAnnotations.findIndex(a => a.from === fromSq && a.to === toSq);
    if (existingIdx !== -1) {
        customAnnotations.splice(existingIdx, 1);
    } else {
        customAnnotations.push({ type: type, from: fromSq, to: toSq, color: currentDrawColor });
    }
    redoAnnotations = [];
    renderCustomAnnotations();
}

function bindBoardDrawingEvents() {
    let wrapper = document.querySelector('.board-wrapper');
    if (!wrapper || wrapper.dataset.drawBound === "1") return;
    wrapper.dataset.drawBound = "1";

    wrapper.addEventListener('touchstart', function(e) {
        if (!drawModeEnabled) return;
        lastTouchTimestamp = Date.now();
        if (e.touches && e.touches.length === 1) {
            let sq = clientPointToSquare(e.touches[0].clientX, e.touches[0].clientY);
            if (sq) {
                e.preventDefault();
                e.stopPropagation();
                isDraggingAnnotation = true;
                dragStartSq = sq;
                dragCurrentSq = sq;
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', function(e) {
        if (!drawModeEnabled || !isDraggingAnnotation) return;
        lastTouchTimestamp = Date.now();
        if (e.touches && e.touches.length === 1) {
            e.preventDefault();
            let sq = clientPointToSquare(e.touches[0].clientX, e.touches[0].clientY);
            if (sq && sq !== dragCurrentSq) {
                dragCurrentSq = sq;
                renderCustomAnnotations();
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', function(e) {
        if (!drawModeEnabled || !isDraggingAnnotation) return;
        lastTouchTimestamp = Date.now();
        e.preventDefault();
        if (e.changedTouches && e.changedTouches.length > 0) {
            let endSq = clientPointToSquare(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            if (endSq) dragCurrentSq = endSq;
        }
        commitAnnotation(dragStartSq, dragCurrentSq || dragStartSq);
        isDraggingAnnotation = false;
        dragStartSq = null;
        dragCurrentSq = null;
        renderCustomAnnotations();
    }, { passive: false });

    wrapper.addEventListener('contextmenu', e => e.preventDefault());

    wrapper.addEventListener('mousedown', function(e) {
        if (Date.now() - lastTouchTimestamp < 600) return;
        if (!drawModeEnabled && e.button !== 2) return;
        let sq = clientPointToSquare(e.clientX, e.clientY);
        if (sq) {
            e.preventDefault();
            e.stopPropagation();
            isDraggingAnnotation = true;
            dragStartSq = sq;
            dragCurrentSq = sq;
        }
    });

    window.addEventListener('mousemove', function(e) {
        if (Date.now() - lastTouchTimestamp < 600) return;
        if (!isDraggingAnnotation) return;
        let sq = clientPointToSquare(e.clientX, e.clientY);
        if (sq && sq !== dragCurrentSq) {
            dragCurrentSq = sq;
            renderCustomAnnotations();
        }
    });

    window.addEventListener('mouseup', function(e) {
        if (Date.now() - lastTouchTimestamp < 600) return;
        if (!isDraggingAnnotation) return;
        commitAnnotation(dragStartSq, dragCurrentSq || dragStartSq);
        isDraggingAnnotation = false;
        dragStartSq = null;
        dragCurrentSq = null;
        renderCustomAnnotations();
    });
}

$(document).ready(function() {
    bindBoardDrawingEvents();
});
