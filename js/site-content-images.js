(function () {
    'use strict';

    var SHAPE_OPTIONS = [
        { id: 'rectangle', label: 'Rectangle' },
        { id: 'rounded', label: 'Rounded corners' },
        { id: 'circle', label: 'Circle' },
        { id: 'pill', label: 'Pill / capsule' }
    ];

    var FIT_OPTIONS = [
        { id: 'cover', label: 'Cover (crop to fill)' },
        { id: 'contain', label: 'Contain (fit inside)' },
        { id: 'fill', label: 'Stretch to fill' }
    ];

    var ALLOWED_SHAPES = SHAPE_OPTIONS.map(function (o) { return o.id; });
    var ALLOWED_FITS = FIT_OPTIONS.map(function (o) { return o.id; });

    function clamp(num, min, max) {
        return Math.max(min, Math.min(max, num));
    }

    function normalizeImageFields(el) {
        if (!el || el.type !== 'image') return el;
        var shape = String(el.shape == null ? 'rounded' : el.shape).toLowerCase();
        if (ALLOWED_SHAPES.indexOf(shape) < 0) shape = 'rounded';
        var objectFit = String(el.objectFit == null ? 'cover' : el.objectFit).toLowerCase();
        if (ALLOWED_FITS.indexOf(objectFit) < 0) objectFit = 'cover';
        var borderRadius = clamp(parseInt(el.borderRadius, 10) || 12, 0, 999);
        var width = clamp(parseFloat(el.width), 5, 100);
        if (!width || isNaN(width)) width = 40;
        var height = parseFloat(el.height);
        if (!height || isNaN(height) || height < 5) {
            height = shape === 'circle' ? width : 28;
        }
        height = clamp(height, 5, 95);
        if (shape === 'circle') height = width;
        if (shape === 'rectangle') borderRadius = 0;
        if (shape === 'pill') borderRadius = 9999;
        return Object.assign({}, el, {
            width: width,
            shape: shape,
            objectFit: objectFit,
            borderRadius: borderRadius,
            height: height,
            url: String(el.url == null ? '' : el.url),
            alt: String(el.alt == null ? '' : el.alt)
        });
    }

    function resolveBorderRadius(el) {
        var item = normalizeImageFields(el);
        if (item.shape === 'circle') return '50%';
        if (item.shape === 'pill') return '9999px';
        if (item.shape === 'rectangle') return '0px';
        return item.borderRadius + 'px';
    }

    function buildImageFrameStyle(el) {
        var item = normalizeImageFields(el);
        var style = [
            'left:' + item.x + '%',
            'top:' + item.y + '%',
            'width:' + item.width + '%',
            'z-index:' + (item.zIndex || 1),
            'border-radius:' + resolveBorderRadius(item),
            'overflow:hidden'
        ];
        if (item.shape === 'circle') {
            style.push('aspect-ratio:1/1');
            style.push('height:auto');
        } else {
            style.push('height:' + item.height + '%');
        }
        return style.join(';') + ';';
    }

    function shapePickerHtml(selected) {
        return SHAPE_OPTIONS.map(function (opt) {
            var label = opt.label.replace(' corners', '').replace(' / capsule', '');
            return [
                '<button type="button" class="cms-image-shape-btn' + (opt.id === selected ? ' is-selected' : '') + '"',
                ' data-el-shape-pick="' + opt.id + '" title="' + opt.label + '">',
                escapeHtml(label),
                '</button>'
            ].join('');
        }).join('');
    }

    function inspectorPreviewHtml(el) {
        var item = normalizeImageFields(el);
        var hasUrl = !!(item.url && item.url.trim());
        var frameStyle = buildImageFrameStyle(Object.assign({}, item, { x: 0, y: 0, width: 100, height: item.shape === 'circle' ? 0 : 56 }));
        if (item.shape === 'circle') {
            frameStyle = 'width:100%;aspect-ratio:1/1;border-radius:50%;overflow:hidden;position:relative;';
        } else {
            frameStyle = 'width:100%;height:140px;border-radius:' + resolveBorderRadius(item) + ';overflow:hidden;position:relative;';
        }
        var inner = hasUrl
            ? '<img src="' + escapeHtml(item.url) + '" alt="" style="' + buildImageTagStyle(item) + '">'
            : '<div class="cms-image-inspector-empty">No image selected</div>';
        return '<div class="cms-image-inspector-preview" style="' + frameStyle + '">' + inner + '</div>';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buildImageTagStyle(el) {
        var item = normalizeImageFields(el);
        return [
            'width:100%',
            'height:100%',
            'display:block',
            'object-fit:' + item.objectFit,
            'border-radius:inherit',
            'pointer-events:none'
        ].join(';') + ';';
    }

    function shapeOptionsHtml(selected) {
        return SHAPE_OPTIONS.map(function (opt) {
            var sel = opt.id === selected ? ' selected' : '';
            return '<option value="' + opt.id + '"' + sel + '>' + opt.label + '</option>';
        }).join('');
    }

    function fitOptionsHtml(selected) {
        return FIT_OPTIONS.map(function (opt) {
            var sel = opt.id === selected ? ' selected' : '';
            return '<option value="' + opt.id + '"' + sel + '>' + opt.label + '</option>';
        }).join('');
    }

    function defaultImageElement(overrides) {
        return normalizeImageFields(Object.assign({
            type: 'image',
            x: 12,
            y: 12,
            width: 40,
            height: 28,
            zIndex: 1,
            url: '',
            alt: '',
            shape: 'rounded',
            borderRadius: 12,
            objectFit: 'cover',
            font: '',
            fontSize: 16,
            color: '#0f172a',
            align: 'left',
            content: ''
        }, overrides || {}));
    }

    window.anytransportCmsImages = {
        SHAPE_OPTIONS: SHAPE_OPTIONS,
        FIT_OPTIONS: FIT_OPTIONS,
        normalizeImageFields: normalizeImageFields,
        resolveBorderRadius: resolveBorderRadius,
        buildImageFrameStyle: buildImageFrameStyle,
        buildImageTagStyle: buildImageTagStyle,
        shapeOptionsHtml: shapeOptionsHtml,
        fitOptionsHtml: fitOptionsHtml,
        shapePickerHtml: shapePickerHtml,
        inspectorPreviewHtml: inspectorPreviewHtml,
        defaultImageElement: defaultImageElement
    };
})();
