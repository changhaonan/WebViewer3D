#include "context.hpp"

void test_add() {
    Context& context = Context::Instance();
    context.addPointCloud("measurement", 0.5);
}

void test_save() {
    Context& context = Context::Instance();
    context.save(1);
}

int main() {
    Context& context = Context::Instance();
    context.setDir("/home/harvey/Project/3DWebViewer/test_data", "frame");
    
    test_add();

    test_save();

}