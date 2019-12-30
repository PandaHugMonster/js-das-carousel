/**
 * @author Ivan "PandaHugMonster" Ponomarev <ivan.ponomarev.pi@gmail.com>
 * @copyright GPLv3
 *
 * Class implementing functionality of "das-carousel"
 *
 * Before the script is connected you can specify: "window.das_carousel_css_class_main" and "window.das_carousel_css_class_slide"
 * those are static, and they should be specified before the script is connected (if you want to change those).
 * It's not recommended to change those css-class definitions, because they are used internally and do not limit you.
 * You just use ".das-carousel" on a main container and ".das-slide" on each slides.
 *
 * For customized usage of the Carousel, you can specify query-selectors through:
 *      DasCarousel.attach('.carousel-number-1, .carousel-number-2, .carousel-number-3')
 *
 * Keep in mind that ".carousel-number-1", ".carousel-number-2" and ".carousel-number-3" should be specified
 * together with ".das-carousel" on the container.
 *
 * If you want to prevent default auto-run of DasCarousel, set "window.das_carousel_please_do_not_run" to true before,
 * connecting this script to the page.
 *
 * TODO Project is unfinished. Please do not use it. The final version is going to be available really soon.
 * TODO Lack of the documentation. Should be fixed.
 *
 * TODO Lack of features: Switching slides by index (navigation buttons)
 */
class DasCarousel {

    /**
     *
     * ## Options
     * @property action_type
     * @property repeats
     * @property direction
     * @property interval
     * @property slide_speed
     * @property carousel_width
     * @property carousel_height
     * @property flex_direction
     * @property scroll_into_callback
     *
     */

    //
    // Properties and Getters/Setters
    get is_forward_directed() { return this.direction === 'forward'; }
    get is_row_flex_directed() { return this.private_flex_direction === 'row'; }
    get carousel_elements() {return this.is_string(this._ref)?document.querySelectorAll(this._ref):[this._ref]}

    //
    // Dynamic Methods
    constructor(element, options) {
        // _ref can't be optimized, because the constructor is running before any of the html elements are loaded,
        // so it should be maximally static.
        this._ref = element;

        // action_type: 'spinning' (infinite spinning), 'round-trip' TODO not implemented yet. Right now spinning only
        this.action_type = options && options.action_type?options.action_type:'spinning';

        // repeats: 'infinite' or number of cycles TODO not implemented yet. Right now infinite only
        this.repeats = options && options.repeats?options.repeats:'infinite';

        this.direction = options && options.direction?options.direction:'forward';
        this.interval = options && options.interval?options.interval:null;
        this.slide_speed = options && options.slide_speed?options.slide_speed:500;
        this.carousel_width = options && options.carousel_width?options.carousel_width:null;
        this.carousel_height = options && options.carousel_height?options.carousel_height:null;
        this.flex_direction = options && options.flex_direction?options.flex_direction:null;
        this.scroll_into_callback = options && options.scroll_into_callback?options.scroll_into_callback:null;

        this.all_timers = [];

        self = this;
        document.addEventListener('visibilitychange', function () {
            self.switch_pause(self, document.hidden);
        });
    }

    pause(carousels, force) {
        if (!carousels) carousels = Array.from(this.carousel_elements);
        if (force === null) force = true;
        if (carousels.constructor !== Array) carousels = [carousels];

        for (let carousel of carousels) {
            carousel.is_das_paused = true;
            if (force !== null) carousel.pause_forced = force;
        }
    }

    unpause(carousels, force_unpause) {
        if (!carousels) carousels = Array.from(this.carousel_elements);
        if (carousels.constructor !== Array) carousels = [carousels];

        for (let carousel of carousels) {
            if (force_unpause || !carousel.pause_forced) {
                carousel.is_das_paused = false;
                carousel.pause_forced = false;
            }
        }
    }

    start_exact_carousel(carousel) {
        let time_interval = this.interval
            ?this.interval
            :(carousel.dataset.dasInterval
                    ?carousel.dataset.dasInterval
                    :5000
            );
        let currently_viewed_element = null;
        let timer = this.run_timer(carousel, time_interval, currently_viewed_element);
        carousel.is_das_active = true;
        this.all_timers.push({timer: timer, carousel: carousel});
    }

    stop_exact_carousel(carousel) {
        let self = this;
        this.all_timers.forEach(function (value, index) {
            if (carousel === value.carousel) {
                clearInterval(value.timer);
                self.all_timers.splice(index, 1);
                carousel.is_das_active = false;
            }
        });
    }

    is_in_all_timers(carousel) {
        for (let index in this.all_timers) {
            let value = this.all_timers[index];
            if (carousel === value.carousel)
                return true;
        }
        return false;
    }

    slides_process(carousel, time_interval, currently_viewed_element) {
        if (carousel.is_das_paused) return currently_viewed_element;

        let slides = Array.from(carousel.querySelectorAll(':scope > .' + DasCarousel.css_class_slide));

        if (!this.is_forward_directed)
            slides = slides.reverse();

        let is_next = false;
        let previous_slide = null;
        let self = this;
        for (let element of slides) {
            if (!currently_viewed_element) {
                currently_viewed_element = element;
                break;
            } if (is_next) {
                is_next = false;
                currently_viewed_element = element;
                self.scroll_into_wrapper(currently_viewed_element, previous_slide);
                this.carousel_children_tree_switch_pause(currently_viewed_element, false, false);
                break;
            } else if (element === currently_viewed_element) {
                is_next = true;
                previous_slide = element;
                this.carousel_children_tree_switch_pause(currently_viewed_element, true, false);
            }
        }
        return currently_viewed_element;
    }

    slide_switched(element, previous_slide) {
        let carousel = this.get_parent(element, '.' + DasCarousel.css_class_main);
        if (this.is_forward_directed) {
            carousel.removeChild(previous_slide);
            carousel.appendChild(previous_slide);
        } else {
            carousel.removeChild(previous_slide);
            carousel.prepend(previous_slide);
        }
        this.correct_relocation_of_slide(element);
    }

    /**
     * TODO If you have a better idea how to implement this function - feel free to provide the feedback, or extend
     *      this class and rewrite it your way
     *      Additionally you can implement "scroll_into_callback" option, that will be called instead of this function.
     *
     * TODO First implementation used "element.scrollIntoView(options)" but it was not fully effective (+ chrome bugs).
     *
     * @param self
     * @param element
     * @param parent
     * @param previous_slide
     */
    scroll_into_implementation(self, element, parent, previous_slide) {
        let di = this.get_element_directed_size(element);

        let step_counter = 100;
        let timeout = self.slide_speed / step_counter;
        let step = Math.ceil(di / step_counter) * (this.is_forward_directed?1:-1);
        let it = setInterval(function (e3) {
            if (di <= 0) {
                clearInterval(it);
                if (previous_slide)
                    self.slide_switched(element, previous_slide);
            } else {
                self.directed_scroll(parent, step);
                di -= Math.abs(step);
            }
        }, timeout);
    }

    correct_relocation_of_slide(element) {
        let parent = this.get_parent(element, '.' + DasCarousel.css_class_main);
        let di = this.get_element_directed_size(element) * (this.is_forward_directed?-1:1);
        this.directed_scroll(parent, di);
    }

    prepare_carousel_node(carousel) {
        let self = this;
        if (carousel.already_prepared) return false;

        carousel.already_prepared = true;
        carousel.pause_forced = false;
        if (this.flex_direction)
            carousel.style.flexDirection = this.flex_direction;
        this.private_flex_direction = this.get_real_attr(carousel, 'flex-direction');

        let slides = carousel.querySelectorAll(':scope > .' + DasCarousel.css_class_slide);

        if (this.carousel_width) {
            carousel.style.width = this.carousel_width + 'px';
            for (let slide of slides)
                slide.style.width = this.carousel_width + 'px';
        }

        if (this.carousel_height) {
            carousel.style.height = this.carousel_height + 'px';
            for (let slide of slides)
                slide.style.height = this.carousel_height + 'px';
        }

        carousel.addEventListener('mouseover', function (event) {
            self.carousel_parent_tree_switch_pause(event.target, true, false);
        });
        carousel.addEventListener('mouseout', function (event) {
            self.carousel_parent_tree_switch_pause(event.target, false, false);
        });

        return true;
    }

    start_carousels() {
        let carousels = this.carousel_elements;
        for (let carousel of carousels) {
            this.prepare_carousel_node(carousel);
            if (!carousel.is_das_active)
                this.start_exact_carousel(carousel);
        }
    }

    stop_carousels() {
        let carousels = this.carousel_elements;
        for (let carousel of carousels) {
            this.stop_exact_carousel(carousel);
        }
    }

    //
    // Helpers
    run_timer(carousel, time_interval, currently_viewed_element) {
        currently_viewed_element = this.slides_process(carousel, time_interval, currently_viewed_element);
        let self = this;
        return setInterval(function (e) {
            currently_viewed_element = self.slides_process(carousel, time_interval, currently_viewed_element);
        }, time_interval);
    }

    get_all_parents(node, selector) {
        let res = [];
        let u = 1000;
        while (u--) {
            node = this.get_parent(node, selector);
            // console.log(node);
            if (node) {
                res.push(node);
                continue;
            }
            break;
        }
        return res;
    }

    get_parent(node, selector) {
        let only_first_parent = false;
        if (!selector)
            only_first_parent = true;
        let parent = node.parentNode;
        if (only_first_parent)
            return parent !== document?parent:null;
        else {

            for (; parent && parent !== document; parent = parent.parentNode) {
                if (parent.matches(selector)) return parent;
            }
        }
        return null;
    }

    get_element_directed_size(element) {
        if (!this.is_row_flex_directed)
            return Math.abs(element.getBoundingClientRect().height);
        return Math.abs(element.getBoundingClientRect().width);
    }

    /**
     *
     * @param element
     * @param previous_slide
     */
    scroll_into_wrapper(element, previous_slide) {
        let parent = this.get_parent(element, '.' + DasCarousel.css_class_main);
        if (this.scroll_into_callback)
            this.scroll_into_callback(this, element, parent, previous_slide);
        else
            this.scroll_into_implementation(this, element, parent, previous_slide);
    }

    is_string(value) { return value.constructor === String; }

    get_real_attr(element, attr) { return window.getComputedStyle(element, null).getPropertyValue(attr); }

    directed_scroll(element, step) {
        if (!this.is_row_flex_directed)
            element.scrollBy(0, step);
        element.scrollBy(step, 0);
    }

    /**
     * If bool of val is true then Pause, if false - then Unpause
     * @param carousels
     * @param val
     * @param force
     */
    switch_pause(carousels, val, force) {
        if (val)
            this.pause(carousels, force);
        else
            this.unpause(carousels, force);
    }

    carousel_parent_tree_switch_pause(carousel, val, force) {
        this.switch_pause(
            this.get_all_parents(carousel, '.' + DasCarousel.css_class_main), val, force
        );
    }

    carousel_children_tree_switch_pause(element, val, force) {
        this.switch_pause(
            element.querySelectorAll('.' + DasCarousel.css_class_main), val, force
        );
    }

    //
    // Static Getters
    static get css_class_main() {
        return window.das_carousel_css_class_main?window.das_carousel_css_class_main:'das-carousel';
    }

    static get css_class_slide() {
        return window.das_carousel_css_class_slide?window.das_carousel_css_class_slide:'das-slide';
    }

    static get carousels() {
        if (!this._carousels)
            this._carousels = [];
        return this._carousels;
    };

    // Static Methods
    static stop_all() {
        for (let das_carousel_obj of DasCarousel.carousels)
            das_carousel_obj.stop_carousels();
    }

    static start_all() {
        for (let das_carousel_obj of DasCarousel.carousels)
            das_carousel_obj.start_carousels();
    }

    static apply_css() {
        let style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.innerHTML = "." + this.css_class_main + " {overflow: hidden; display: flex}\n";
        style.innerHTML += "." + this.css_class_slide + " {height: 100%; box-sizing: border-box; flex-shrink: 0}\n";
        document.getElementsByTagName('head')[0].appendChild(style);
    }

    /**
     *
     * @param element on which carousel should be applied or string-selector with query
     * @param options
     */
    static attach(element, options) {
        this.carousels;
        this._carousels.push(new this(element, options));
    }

    static dom_content_loaded_method(event) {

        for (let das_carousel_obj of DasCarousel.carousels) {
            das_carousel_obj.start_carousels();
        }
    }

    static please_run() {
        if (!this.das_carousel_already_running) {
            this.das_carousel_already_running = true;

            this.apply_css();
            document.addEventListener('DOMContentLoaded', this.dom_content_loaded_method);
        } else
            console.log('DasCarousel is already running');
    }
}

if (!window.das_carousel_please_do_not_run)
    DasCarousel.please_run();
