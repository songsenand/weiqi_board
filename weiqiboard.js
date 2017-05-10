"use strict";

var WeiQiBoard = function(id, status) {
    $("#" + id).append("<canvas id=\"" + id + "\"></canvas>");
    var self = this;
    var $canvas = $("canvas#" + id);
    var ctx = $canvas[0].getContext("2d");
    this.id = id;
    var board_status = 0; // 取值0-2 0：棋局尚未开始， 1：等待本方落子， 2：等待对方落子；
    var letter = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
    ]
    var letterturn = 0;

    var signal = {
        recvstep: "recvstep",
        getstep: "getstep",
        getsign: "getsign",
        viewstep: "viewstep",
        backgame: "backgame",
    }

    var line_num = 19;
    var w_line = 2;
    var board_size = 0;
    var unit_len = 10;
    var step_arr = new Array; // step_arr[i]包含2块内容 [color(0-4), POS(int pos)].
    var board_state = new Array; // board_state[i]显示棋盘上每个位置.
    var dragon_map = new Array; // dragon_map[i] 棋盘上每个位置所属的dragon的id

    var show_mode = 0; // 取值0-2  0显示+ 1显示手数 2显示拉丁字母Δ 和英文大写字母ABC等标识符。
    var curr_color = 1; // color(0-4). 其中1是黑色， 2是白色， 3是黑色试下， 4是白色试下.
    var live_check = new Array;

    var board_sign = new Array;

    var stone_size = 0;
    var dragon = new Array;
    var prev2_board = new Array(361);
    var prev_board = new Array(361);
    var prev_dragon_map = new Array;
    var store_board_state = new Array();
    var store_dragon_map = new Array();
    var dragon_id_list = new Array();
    var curr_step = 0;

    var curr_pos = -1;

    var view_state = 0; // 取值0-3，0表示正在下棋，1表示在回看,2表示试下,3表示试下中回看.
    var branch_step = -1;
    var branch_board_state = new Array();
    var branch_dragon_map = new Array();
    var branch_step_arr = new Array();

    var count_pass = 0;
    var playmode = 0; //取值 0 - 4  0是说网络对局， 1是说本地对局 2是说看棋 3是说解说棋局，4是说导入棋局

    var getStep_callback = function(msg, value) {
        console.log(msg, value);
    }

    if (status) {
        if (status.id) {
            this.id = id;
        }
        if (status.line_num) {
            line_num = status.line_num;
        }
        if (status.firstcolor) {
            curr_color = status.firstcolor;
        }
        if (status.line_width) {
            w_line = status.line_width;
        }
        if (status.showmode) {
            show_mode = status.showmode;
        }
        if (status.playmode) {
            playmode = status.playmode;
        }
    }


    var nearstone_cross = [1, -1, line_num, -line_num]; // 辅助，方便获取相邻棋子。
    var cross_num = line_num * line_num - 1;
    var canvas_size = Math.min($("#" + id).width(), $("#" + id).height());
    board_size = canvas_size * 0.95;
    var stoneboard_start = canvas_size * 0.025;
    var unit_len = board_size / (line_num - 1);
    var stone_size = 0.4 * unit_len;
    $canvas[0].height = 2 * stoneboard_start + unit_len * (line_num - 1);
    $canvas[0].width = 2 * stoneboard_start + unit_len * (line_num - 1);

    for (var i = 0; i <= cross_num; i++) {
        board_state[i] = 0;
        dragon_map[i] = -1;
        board_sign[i] = 0;
        live_check[i] = 0;
    }

    store_board_state[0] = board_state.slice();
    store_dragon_map[0] = dragon_map.slice();
    step_arr[0] = "game info";
    var prev2_board = prev_board.slice();
    var prev_board = board_state.slice();

    var POS = function(x, y) {
        if (x <= 0 && x > line_num) {
            return -1;
        }
        if (y <= 0 && y > line_num) {
            return -1;
        }
        return x + y * (line_num);
    }

    var get_nearstone = function(pos) {
        var neighbor_arr = new Array();
        for (var i = 0; i < 4; i++) {
            var neighbor = nearstone_cross[i] + pos;
            if (is_onboard(neighbor)) {
                if (nearstone_cross[i] != 1 || neighbor % line_num != 0) {
                    if (nearstone_cross[i] != -1 || (neighbor + 1) % line_num != 0)
                        neighbor_arr.push(neighbor);
                }
            }
        }
        return neighbor_arr;
    }

    var is_onboard = function(pos) {
        if (pos >= 0 && pos <= cross_num) {
            return true;
        } else {
            return false;
        }
    }

    var get_Pstate = function(pos, board) {
        if (arguments[1]) {
            var view_board = board;
        } else {
            var view_board = board_state;
        }

        if (view_board[pos] == 0) {
            return 0;
        } else if (view_board[pos] == curr_color || view_board[pos] == curr_color + 2 || view_board[pos] == curr_color - 2) {
            return 1;
        } else {
            return 2;
        }
    }

    var sign_stone = function(dragon_id) {
        var dragon_stone = dragon[dragon_id][1]
        var dragon_size = dragon_stone.length
        for (var i = 0; i < dragon_size; i++) {
            dragon_map[dragon_stone[i]] = dragon_id;
        }
    }

    var get_crossinfo = function(view_board) {
        switch (view_state) {
            case (0):
                var pos = step_arr[curr_step][1];
                return [
                    get_coor(pos),
                    get_otherColor(view_board[pos])
                ];
            case (1):
                var pos = step_arr[curr_step][1];
                return [
                    get_coor(pos),
                    get_otherColor(view_board[pos])
                ];
            case (2):
                var pos = branch_step_arr[curr_step - branch_step][1];
                return [
                    get_coor(pos),
                    get_otherColor(view_board[pos])
                ];
            case (3):
                var pos = branch_step_arr[curr_step - branch_step][1];
                return [
                    get_coor(pos),
                    get_otherColor(view_board[pos])
                ];
        }
    }

    var get_otherColor = function(color) {
        switch (color) {
            case 1:
                return "rgb(255, 255, 255)";
            case 2:
                return "rgb(0, 0, 0)";
            case 3:
                return "rgb(255, 255, 255)";
            case 4:
                return "rgb(0, 0, 0)";
            default:
                return "rgb(0, 0, 0)";
        }
    }

    var kill_stone = function(dragon_id) {
        var count_Dstone = dragon[dragon_id][1].length
        for (var i = 0; i < count_Dstone; i++) {
            var stone = dragon[dragon_id][1][i];
            board_state[stone] = 0;
            dragon_map[stone] = -1;
        }
    }

    var check_ko = function() {
        if (curr_step >= 5) {
            if (board_state.join("") == prev2_board.join("")) {
                return false;
            }
        }
        return true;
    }

    var printStep = function(pos, board_step, view_board) {
        if (board_step[pos] !== 0) {
            var coor = get_coor(pos);
            ctx.fillStyle = get_otherColor(view_board[pos]);
            ctx.fillText(board_step[pos], coor[0], coor[1], 1.4 * stone_size)
        }
    }

    var drawBoard = function(board) {
        if (arguments[0]) {
            var view_board = board.slice(0);
        } else {
            var view_board = board_state.slice(0);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = "rgb(0, 0, 0)"
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = stone_size + "px 黑体"

        ctx.clearRect(0, 0, $canvas[0].width, $canvas[0].height);
        ctx.beginPath();
        ctx.fillStyle = "rgb(250,250,250)";
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);

        ctx.lineWidth = w_line;

        for (var i = 0; i < line_num; i++) {
            var start_coor_x = stoneboard_start;
            var end_coor_x = board_size + stoneboard_start;
            var coor_y = stoneboard_start + unit_len * i;
            ctx.moveTo(start_coor_x, coor_y);
            ctx.lineTo(end_coor_x, coor_y);
        }

        for (var i = 0; i < line_num; i++) {
            var coor_x = stoneboard_start + unit_len * i;
            var start_coor_y = stoneboard_start;
            var end_coor_y = board_size + stoneboard_start;
            ctx.moveTo(coor_x, start_coor_y);
            ctx.lineTo(coor_x, end_coor_y);
        }
        ctx.strokeStyle = "rgb(170,170,170)"; //150
        ctx.stroke();

        ctx.fillStyle = "rgb(180,180,180)"; //160

        for (var i = 0; i < 3; i++) {
            var star_y = stoneboard_start + unit_len * (i * 6 + 3);
            for (var j = 0; j < 3; j++) {
                ctx.beginPath();
                var star_x = stoneboard_start + unit_len * (j * 6 + 3);
                ctx.arc(star_x, star_y, 2 * w_line, 0, Math.PI * 2, false);
                ctx.fill();
                ctx.stroke();
            }
        }


        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.lineWidth = 1;

        for (var pos = 0; pos <= cross_num; pos++) {
            ctx.beginPath();
            drawStone(pos, view_board);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.lineWidth = w_line;
        signBoard(view_board);

    }

    var drawStone = function(pos, view_board) {
        var coor = get_coor(pos);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.shadowColor = "rgb(0, 0, 0)"
        switch (view_board[pos]) {
            case 1:
                ctx.fillStyle = "rgb(0,0,0)";
                ctx.beginPath();
                ctx.arc(coor[0], coor[1], stone_size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 2:
                ctx.fillStyle = "rgb(255,255,255)";
                ctx.beginPath();
                ctx.arc(coor[0], coor[1], stone_size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 3:
                ctx.shadowBlur = 3;
                ctx.fillStyle = "rgb(80,80,80)";
                ctx.beginPath();
                ctx.arc(coor[0], coor[1], stone_size * 0.9, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 4:
                ctx.shadowBlur = 5;
                ctx.fillStyle = "rgb(245,245,245)";
                ctx.beginPath();
                ctx.arc(coor[0], coor[1], stone_size * 0.9, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    var get_coor = function(pos) {
        if (pos >= 0 && pos <= cross_num) {
            var stone_coor = get_stone_coor(pos);
            var stone_x = stoneboard_start + unit_len * stone_coor[0];
            var stone_y = stoneboard_start + unit_len * stone_coor[1];
            return [stone_x, stone_y];
        }
    }

    var get_stone_coor = function(pos) {
        var x = pos % line_num;
        var y = Math.floor(pos / line_num);
        return [x, y];
    }

    var signBoard = function(view_board) {
        switch (show_mode) {
            case (0):
                drawCross(view_board);
                drawSign(view_board);
                break;
            case (1):
                drawStep(view_board);
                drawSign(view_board);
                break;
            case (2):
                drawCross(view_board);
                break;
        }
    }

    var drawCross = function(view_board) {
        if (curr_step >= 1) {
            var pos_info = get_crossinfo(view_board);
            if (pos_info[0]) {
                ctx.beginPath();
                ctx.moveTo(pos_info[0][0] - 0.45 * stone_size, pos_info[0][1]);
                ctx.lineTo(pos_info[0][0] + 0.45 * stone_size, pos_info[0][1]);
                ctx.moveTo(pos_info[0][0], pos_info[0][1] - 0.45 * stone_size);
                ctx.lineTo(pos_info[0][0], pos_info[0][1] + 0.45 * stone_size);
                ctx.strokeStyle = pos_info[1];
                ctx.stroke();
            }
        }
    }

    var drawStep = function(view_board) {
        var board_step = new Array();
        for (var i = 0; i <= cross_num; i++) {
            board_step[i] = 0;
        }
        switch (view_state) {
            case 0:
                for (var step_num = 1; step_num <= curr_step; step_num++) {
                    var pos = step_arr[step_num][1]
                    if (view_board[pos] !== 0) {
                        board_step[pos] = step_num;
                    }
                }
                break;
            case 1:
                for (var step_num = 1; step_num <= curr_step; step_num++) {
                    var pos = step_arr[step_num][1]
                    if (view_board[pos] !== 0) {
                        board_step[pos] = step_num;
                    }
                }
                break;
            case 2:
                var branch_cnt = curr_step - branch_step;
                for (var step_num = 1; step_num <= branch_cnt; step_num++) {
                    var pos = branch_step_arr[step_num][1];
                    if (view_board[pos] !== 0) {
                        board_step[pos] = step_num;
                    }
                }
                break;
            case 3:
                var branch_cnt = curr_step - branch_step;
                for (var step_num = 1; step_num <= branch_cnt; step_num++) {
                    var pos = branch_step_arr[step_num][1];
                    if (view_board[pos] !== 0) {
                        board_step[pos] = step_num;
                    }
                }
                break;
        }
        for (var pos = 0; pos <= cross_num; pos++) {
            printStep(pos, board_step, view_board);
        }
    }

    var drawSign = function(view_board) {
        ctx.font = unit_len + "px 黑体";
        for (var i = 0; i <= cross_num; i++) {
            if (board_sign[i] !== 0) {
                var coor = get_coor(i);
                ctx.fillStyle = get_otherColor(view_board[i]);
                ctx.fillText(board_sign[i], coor[0], coor[1]);
            }
        }
    }

    var click_pos = function(e) {
        var canvasOffset = $canvas.offset();
        var canvasX = Math.round((e.pageX - canvasOffset.left - stoneboard_start) / unit_len);
        var canvasY = Math.round((e.pageY - canvasOffset.top - stoneboard_start) / unit_len);
        var pos = POS(canvasX, canvasY);
        return pos;
    }

    var get_stone = function(pos) {
        if (view_state == 1) {
            attempt();
        } else if (view_state == 3) {
            attempt2();
        }

        if (board_state[pos] == 0 && pos >= 0) {
            var dragon_id = dragon.length;
            dragon[dragon_id] = new Array();
            dragon[dragon_id][0] = curr_color;
            dragon[dragon_id][1] = new Array();
            dragon[dragon_id][1].push(pos)
            board_state[pos] = curr_color;
            dragon_map[pos] = dragon_id;

            var is_legal = get_dragon(pos, dragon_id);
            if (is_legal == true) {
                curr_pos = pos;
                stepin(pos);
                count_pass = count_pass - 1;
                if (board_status == 1) {
                    PubSub.publish(signal.getstep, { pos: pos });
                    PubSub.publish(signal.change_player, {});
                } else {
                    PubSub.publish(signal.recvstep, {})
                    PubSub.publish(signal.change_player, {});
                }
            } else {
                board_state[pos] = 0;
                dragon_map[pos] = -1;
                if (board_status == 2) {
                    PubSub.publish(signal.getstep, { err: "recvstep err" })
                }
            }
        } else if (pos < 0) {
            if (count_pass < 2) {
                count_pass++;
                stepin(pos);
            } else {
                gameend();
            }
        } else if (board_state[pos] != 0) {
            if (board_status == 2) {
                PubSub.publish(signal.getstep, { err: "recvstep err" })
            }
        }
    }

    var gameend = function() {
        wait_step();
    }

    var attempt = function() {
        view_state = 2;
        branch_step = curr_step;
        if (curr_step == 0) {
            curr_color = 3;
        } else {
            curr_color = step_arr[curr_step][0] + 2;
        }
        board_state = store_board_state[curr_step].slice();
        dragon_map = store_dragon_map[curr_step].slice();
        branch_board_state[0] = board_state.slice();
        prev_board = board_state.slice();
        if (curr_step > 3) {
            prev2_board = store_board_state[curr_step - 1].slice();
        }
        prev_dragon_map = store_dragon_map[curr_step].slice();
        branch_step_arr[0] = step_arr[curr_step].slice();
    }

    var attempt2 = function() {
        view_state = 2;
        curr_color = branch_step_arr[curr_step - branch_step][0];
        board_state = branch_board_state[curr_step - branch_step].slice();
        dragon_map = branch_dragon_map[curr_step - branch_step].slice();
        prev_board = board_state.slice();
        if (curr_step > 3) {
            prev2_board = branch_board_state[curr_step - branch_step - 1].slice();
        }
        branch_step_arr = branch_step_arr.slice(0, curr_step - branch_step + 1);
    }

    var stepin = function(pos) {
        curr_step++;
        prev2_board = prev_board.slice();
        prev_board = board_state.slice();
        prev_dragon_map = dragon_map.slice();
        change_player();
        if (view_state == 0) {
            step_arr.push([curr_color, pos]);
            store_board_state.push(board_state.slice());
            store_dragon_map.push(dragon_map.slice());
        } else if (view_state == 2) {
            branch_step_arr[curr_step - branch_step] = [curr_color, pos];
            branch_board_state[curr_step - branch_step] = board_state.slice();
            branch_dragon_map[curr_step - branch_step] = dragon_map.slice();
        }
    }

    var change_player = function() {
        switch (curr_color) {
            case 1:
                curr_color = 2;
                break;
            case 2:
                curr_color = 1;
                break;
            case 3:
                curr_color = 4;
                break;
            case 4:
                curr_color = 3;
                break;
        }
    }

    var get_live = function(dragon_id) {
        var count_live = 0;
        var live_arr = new Array();
        var count_Dstone = dragon[dragon_id][1].length;
        for (var i = 0; i < count_Dstone; i++) {
            var neighbor = get_nearstone(dragon[dragon_id][1][i]);
            var count_neib = neighbor.length;
            for (var j = 0; j < count_neib; j++) {
                if (board_state[neighbor[j]] == 0 && live_arr.indexOf(neighbor[j])) {
                    live_arr.push(neighbor[j]);
                    count_live++;
                }
            }
        }
        return count_live;
    }

    var get_dragon = function(pos, dragon_id) {
        var dragon_list = [];
        var neighbor = get_nearstone(pos);
        var count_neib = neighbor.length; // 将数组长度储存至变量中， 可明显提高遍历数组的效率.
        for (var i = 0; i < count_neib; i++) {
            var pos_state = get_Pstate([neighbor[i]])
            if (pos_state == 1) {
                if (dragon_list.indexOf(neighbor[i]) < 0) {
                    dragon_list.push(neighbor[i]);
                    dragon[dragon_id][1] = dragon[dragon_id][1].concat(dragon[dragon_map[neighbor[i]]][1]);
                }
            } else if (pos_state == 2) {
                var neighbor_dragon = dragon_map[neighbor[i]];
                if (get_live(neighbor_dragon) == 0) {
                    kill_stone(neighbor_dragon);
                    if (!check_ko()) {
                        dragon_map = prev_dragon_map.slice();
                        board_state = prev_board.slice();
                        return false;
                    }
                }
            }
        }

        if (get_live(dragon_id)) {
            sign_stone(dragon_id);
            return true;
        } else {
            return false;
        }
    }

    var is_stinbrc = function(curr_step) { // is step in branch.
        if (curr_step > branch_step && curr_step < branch_step + branch_step_arr.length - 1) {
            return true;
        } else {
            return false;
        }
    }

    drawBoard();

    (function() {
        $(window).resize(function() {
            canvas_size = Math.min($("#" + id).width(), $("#" + id).height());
            board_size = canvas_size * 0.95;
            stoneboard_start = canvas_size * 0.025;
            unit_len = board_size / (line_num - 1);
            stone_size = 0.4 * unit_len;
            $canvas[0].height = 2 * stoneboard_start + unit_len * (line_num - 1);
            $canvas[0].width = 2 * stoneboard_start + unit_len * (line_num - 1);
            drawBoard();
        })
    }());

    this.clear_board = function() {
        step_arr = new Array; // step_arr[i]包含2块内容 [color(0-4), POS(int pos)].
        board_state = new Array; // board_state[i]显示棋盘上每个位置.
        dragon_map = new Array; // dragon_map[i] 棋盘上每个位置所属的dragon的id

        show_mode = 0; // 取值0-2  0显示+ 1显示手数 2显示拉丁字母Δ 和英文大写字母ABC等标识符。
        curr_color = 1; // color(0-6). 其中1是黑色， 2是白色， 3是黑色试下， 4是白色试下， 5是黑色势力范围， 6是白色势力范围
        board_sign = new Array;
        live_check = new Array;

        dragon = new Array;
        prev2_board = new Array(361);
        prev_board = new Array(361);
        prev_dragon_map = new Array;
        store_board_state = new Array();
        store_dragon_map = new Array();
        dragon_id_list = new Array();
        curr_step = 0;

        curr_pos = -1;

        view_state = 0; // 取值0-3，0表示正在本地下棋，1表示在回看,2表示试下,3表示试下中回看.
        branch_step = -1;
        branch_board_state = new Array();
        branch_dragon_map = new Array();
        branch_step_arr = new Array();

        count_pass = 0;

        if (status) {
            if (status.firstcolor) {
                curr_color = status.firstcolor;
            }
            if (status.showmode) {
                show_mode = status.showmode;
            }
        }

        for (var i = 0; i <= cross_num; i++) {
            board_state[i] = 0;
            dragon_map[i] = -1;
            board_sign[i] = 0;
            live_check[i] = 0;
        }

        store_board_state[0] = board_state.slice();
        store_dragon_map[0] = dragon_map.slice();
        step_arr[0] = "game info";
        prev2_board = prev_board.slice();
        prev_board = board_state.slice();
        drawBoard()
    }

    this.trymode = function() {
        view_state = 1;
    }

    this.backgame = function() {
        if (view_state != 0) {
            view_state = 0;
            curr_step = store_board_state.length - 1;
            board_state = store_board_state[curr_step].slice();
            dragon_map = store_dragon_map[curr_step].slice();
            prev_board = board_state.slice();
            if (curr_step != 0) {
                curr_color = step_arr[curr_step][0];
            } else {
                curr_color = 1;
            }
            change_player;
            curr_pos = step_arr[curr_step][1];
            if (curr_step > 3) {
                prev2_board = store_board_state[curr_step - 1].slice();
            }
            prev_dragon_map = store_dragon_map[curr_step].slice();
            branch_board_state = new Array();
            branch_dragon_map = new Array();
            branch_step = -1;
        }
        drawBoard();
        PubSub.publish(signal.backgame, {});
    }

    this.prev_step = function() {
        if (view_state == 0) {
            view_state = 1;
        }
        if (curr_step >= 1) {
            curr_step--;
            if (view_state == 1) {
                drawBoard(store_board_state[curr_step]);
            } else if (view_state == 2) {
                view_state = 3;
                drawBoard(branch_board_state[curr_step - branch_step]);
            } else if (view_state == 3 && curr_step > branch_step) {
                drawBoard(branch_board_state[curr_step - branch_step]);
            } else {
                view_state = 1;
                drawBoard(store_board_state[curr_step]);
            }
        }
        PubSub.publish(signal.viewstep, { step: -1 });
    }

    this.next_step = function() {
        if (view_state == 1 && curr_step < step_arr.length - 1) {
            curr_step++;
            drawBoard(store_board_state[curr_step]);
        } else if (view_state == 3 && is_stinbrc(curr_step)) {
            curr_step++;
            drawBoard(branch_board_state[curr_step - branch_step]);
        }
        PubSub.publish(signal.viewstep, { step: 1 });
    }

    this.skip2step = function(step_num) {
        if (view_state == 0 || view_state == 1) {
            view_state = 1;
            if (step_num >= 0 && step_num <= step_arr.length - 1) {
                curr_step = step_num;
                board_state = store_board_state[step_num].slice()
                drawBoard(board_state);
            }
        } else if (view_state == 2 || view_state == 3) {
            if (step_num >= 0 && step_num < branch_step) {
                curr_step = step_num + branch_step;
                board_state = branch_board_state[step_num].slice()
                if (step_num == 0) {
                    view_state = 1;
                }
                drawBoard(board_state);
            }
        }
    }

    var board_click = function() {
        $canvas.unbind();
        $canvas.bind("click", function(e) {
            var pos = click_pos(e);
            get_stone(pos);
            drawBoard();
        });
    }

    this.addcheckres = function() {
        $canvas.unbind();
        $canvas.bind("click", function(e) {
            var pos = click_pos(e)
            console.log(pos);
            var check_id = dragon_map[pos]
            if (check_id !== -1) {
                var stonearr = dragon[check_id][1];
                for (var stone in stonearr) {
                    console.log(stone);
                    if (live_check[stonearr[stone]] === 0) {
                        live_check[stonearr[stone]] = 1;
                    } else {
                        live_check[stonearr[stone]] = 0
                    }
                }
                drawBoard();
                for (var i = 0; i < cross_num; i++) {
                    if (live_check[i] !== 0) {
                        console.log(i);
                        var coor = get_coor(i);
                        ctx.fillStyle = get_otherColor(board_state[i]);
                        ctx.fillText("=", coor[0], coor[1]);
                    }
                }
            }
        });
    }


    var wait_step = function(msg, value) {
        console.log(msg, value, "from wait_step");
        $canvas.unbind();
    }

    this.recvStep = function(msg) {
        if (msg.view_mode) {
            view_state = msg.view_mode;
            return;
        }

        if (msg.pos) {
            if (board_status != 1) {
                get_stone(msg.pos);
            }
            return;
        }

        if (msg.endgame) {
            endgamd();
            return;
        }
        if (msg.resign) {
            endgame();
            return;
        }
        if (msg.steparr) {
            var len_step = msg.steparr.length;
            for (var i = 0; i < len_step; i++) {
                get_stone(msg.steparr[i]);
            }
        }
        drawBoard();
    }

    this.getStoneCallback = function(getStep_callback_func) {
        if (arguments[0] && typeof(arguments[0]) == "function") {
            getStep_callback = function(msg, value) {
                getStep_callback_func(msg, value);
            };
        }
    }

    this.change_showmode = function(mode) {
        show_mode = mode;
    }

    this.take_back = function() {
        if (curr_step >= 1 && view_state == 0) {
            if (board_status === 1) {
                PubSub.publish(signal.getstep, { step: -1 });
            } else {
                return;
            }
            curr_step--;
            change_player();
            dragon_map = store_dragon_map[curr_step].slice();
            board_state = store_board_state[curr_step].slice();
            store_dragon_map.pop();
            store_board_state.pop();
            step_arr.pop();
            curr_pos = step_arr[curr_step][1];

            drawBoard();
        }
    }

    this.addsign = function() {
        $canvas.unbind();
        $canvas.bind({
            click: function(e) {
                var pos = click_pos(e);
                board_sign[pos] = letter[letterturn];
                if (letterturn < 25) {
                    letterturn++;
                } else {
                    letterturn = 0
                }
                PubSub.publish(signal.getsign, { sign: letter[letterturn], pos: pos })
                drawBoard();
            },
            mousemove: function(e) {
                var canvasOffset = $canvas.offset();
                var canvasX = e.pageX - canvasOffset.left;
                var canvasY = e.pageY - canvasOffset.top;
                drawBoard(board_state);
                ctx.font = unit_len + "px 黑体";
                ctx.fillStyle = "rgb(0,0,0)";
                ctx.fillText(letter[letterturn], canvasX, canvasY);
            }
        });
    }

    this.err_handle = function() {}

    var get_err = function(msg, value) {
        if (value.err) {
            this.err_handle();
        }
    }

    this.getStart = function(startplayer) {
        PubSub.subscribe(signal.getstep, getStep_callback);
        if (playmode === 0) {
            PubSub.subscribe(signal.getstep, wait_step);
            PubSub.subscribe(signal.recvstep, board_click)
            PubSub.subscribe(signal.change_player, function() {
                board_status = board_status == 1 ? 2 : 1;
            })

            if (startplayer === 0) {
                board_status = 1;
                board_click();
            } else {
                board_status = 2;
                wait_step();
            }
        } else if (playmode === 1) {
            board_click();
        } else if (playmode === 2) {
            wait_step();
            board_status = 0;
        } else if (playmode === 3) {
            board_click();
            board_status = 0;
        } else if (playmode === 4) {
            wait_step();
            PubSub.subscribe(signal.recvstep, get_err);
            board_status = 2;
        }
    }
}