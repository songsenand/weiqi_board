# 简易html canvas 的围棋棋盘

​	**jqury 和 pubsub.js必须**

​	2015年下半年找个开源围棋棋盘，结果最好的一个也没能解决打劫的问题，不知天高地厚的决定自己写个，即成。

​	写这个的时候完全不懂js（现在也不懂），当时认为js是简化版的C，后来边写边学，才知道js居然是函数式编程，用了函数式的部分特性。

​	部分受到GNUGO项目影响，如使用棋盘使用一维数组表示等，虽然没能理解原因……

​	使用方便：在页面中只需要添加：

`html: <div id="xxxxxx"></div>`

`js: var xxx = new WeiQiBoard(id, status)` 

​	即可使用



作者：songsenand

email：songsenand@gmail.com

2015年 - 2017年