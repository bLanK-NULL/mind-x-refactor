# bug

- undo和redo的快捷键有问题;但是editor-toolbar的按钮是好的
怀疑是codemirror自带的快捷键和我的快捷键同时触发了导致问题;

# 优化
- 整理出可以沉淀到mind-engine的代码 
- mind-engine 深拷贝太多，且web目录下使用mind-engine方法的地方深拷贝是否冗余。是否充分利用了immer？
- Vite 的大 chunk warning

# 展望
- 协同编辑
